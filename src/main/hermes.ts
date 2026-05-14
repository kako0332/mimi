import Store from 'electron-store'
import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import WebSocket from 'ws'

interface HermesConfig {
  apiUrl: string
  apiKey: string
  alwaysOnTop: boolean
  autoStart: boolean
  dashboardUrl: string
  theme: string
  live2dModel: string
}

const store = new Store<HermesConfig>({
  defaults: {
    apiUrl: 'https://open.bigmodel.cn/api/anthropic',
    apiKey: '',
    alwaysOnTop: true,
    autoStart: false,
    dashboardUrl: 'http://localhost:9119',
    theme: 'blue',
    live2dModel: 'hiyori'
  }
})

export class HermesClient {
  private sessionToken: string = ''
  private ws: WebSocket | null = null
  private sessionId: string = ''
  private rpcId = 0
  private pendingRpc: Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }> = new Map()
  private eventHandler: ((event: { type: string; payload?: any }) => void) | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  getConfig(): HermesConfig {
    return {
      apiUrl: store.get('apiUrl'),
      apiKey: store.get('apiKey'),
      alwaysOnTop: store.get('alwaysOnTop'),
      autoStart: store.get('autoStart'),
      dashboardUrl: store.get('dashboardUrl'),
      theme: store.get('theme'),
      live2dModel: store.get('live2dModel')
    }
  }

  setConfig(config: Partial<HermesConfig>): void {
    for (const [key, value] of Object.entries(config)) {
      if (value !== undefined) {
        store.set(key as keyof HermesConfig, value)
      }
    }
  }

  private dashboardHeaders(): Record<string, string> {
    const headers: Record<string, string> = {}
    if (this.sessionToken) {
      headers['X-Hermes-Session-Token'] = this.sessionToken
    }
    return headers
  }

  async fetchSessionToken(): Promise<string> {
    const config = this.getConfig()
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const res = await fetch(config.dashboardUrl, {
          signal: AbortSignal.timeout(5000)
        })
        const html = await res.text()
        const match = html.match(/SESSION_TOKEN__="([^"]+)"/)
        if (match) {
          this.sessionToken = match[1]
          return this.sessionToken
        }
      } catch {
        // Dashboard not running yet, wait and retry
      }
      await new Promise(r => setTimeout(r, 2000))
    }
    return this.sessionToken
  }

  private getWsUrl(): string {
    const config = this.getConfig()
    const httpUrl = config.dashboardUrl.replace(/^http/, 'ws')
    return `${httpUrl}/api/ws?token=${this.sessionToken}`
  }

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return

    if (!this.sessionToken) {
      await this.fetchSessionToken()
    }
    if (!this.sessionToken) {
      throw new Error('No session token')
    }

    return new Promise((resolve, reject) => {
      const url = this.getWsUrl()
      const ws = new WebSocket(url)

      ws.on('open', () => {
        this.ws = ws
        resolve()
      })

      ws.on('message', (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString())
          this.handleMessage(msg)
        } catch { /* ignore parse errors */ }
      })

      ws.on('close', () => {
        this.ws = null
        // Reject pending RPCs
        for (const [, p] of this.pendingRpc) {
          p.reject(new Error('WebSocket closed'))
        }
        this.pendingRpc.clear()
        // Auto-reconnect after 5s
        this.scheduleReconnect()
      })

      ws.on('error', (err: Error) => {
        this.ws = null
        reject(err)
      })
    })
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect().catch(() => {})
    }, 5000)
  }

  private handleMessage(msg: any): void {
    // RPC response
    if (msg.id !== undefined && this.pendingRpc.has(msg.id)) {
      const p = this.pendingRpc.get(msg.id)!
      this.pendingRpc.delete(msg.id)
      if (msg.error) {
        p.reject(new Error(msg.error.message || 'RPC error'))
      } else {
        p.resolve(msg.result)
      }
      return
    }

    // Event notification
    if (msg.method === 'event' && msg.params) {
      this.eventHandler?.({ type: msg.params.type, payload: msg.params.payload })
    }
  }

  private async rpc(method: string, params: Record<string, any> = {}): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect()
    }
    const id = ++this.rpcId
    return new Promise((resolve, reject) => {
      this.pendingRpc.set(id, { resolve, reject })
      const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params })
      this.ws!.send(msg)
      // Timeout after 120s
      setTimeout(() => {
        if (this.pendingRpc.has(id)) {
          this.pendingRpc.delete(id)
          reject(new Error('RPC timeout'))
        }
      }, 120000)
    })
  }

  onEvent(handler: (event: { type: string; payload?: any }) => void): void {
    this.eventHandler = handler
  }

  async checkConnection(): Promise<{ connected: boolean; error?: string }> {
    try {
      await this.connect()
      return { connected: true }
    } catch (err: any) {
      return { connected: false, error: err.message }
    }
  }

  // --- Chat via WebSocket ---

  async chat(text: string, onChunk: (chunk: { type: string; content: string }) => void): Promise<void> {
    try {
      // Ensure connected
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        await this.connect()
      }

      // Create session if needed
      if (!this.sessionId) {
        const result = await this.rpc('session.create', { cols: 120 })
        this.sessionId = result.session_id
      }

      // Set up event handler for this chat
      this.onEvent((event) => {
        switch (event.type) {
          case 'message.delta':
            if (event.payload?.text) {
              onChunk({ type: 'text', content: event.payload.text })
            }
            break
          case 'thinking.delta':
            if (event.payload?.text) {
              onChunk({ type: 'thinking', content: event.payload.text })
            }
            break
          case 'tool.start':
            onChunk({
              type: 'tool_start',
              content: JSON.stringify({
                id: event.payload?.tool_id,
                name: event.payload?.name,
                context: event.payload?.context
              })
            })
            break
          case 'tool.complete':
            onChunk({
              type: 'tool_complete',
              content: JSON.stringify({
                id: event.payload?.tool_id,
                name: event.payload?.name,
                summary: event.payload?.summary
              })
            })
            break
          case 'message.complete':
            if (event.payload?.status === 'error') {
              onChunk({ type: 'error', content: event.payload.text || 'Unknown error' })
            }
            onChunk({ type: 'done', content: '' })
            break
          case 'error':
            onChunk({ type: 'error', content: event.payload?.message || 'Agent error' })
            onChunk({ type: 'done', content: '' })
            break
        }
      })

      // Submit prompt
      await this.rpc('prompt.submit', { session_id: this.sessionId, text })
    } catch (err: any) {
      onChunk({ type: 'error', content: err.message })
    }
  }

  // Reset session (e.g. on new conversation)
  resetSession(): void {
    this.sessionId = ''
  }

  // --- Skills ---
  async getSkills(): Promise<any[]> {
    const config = this.getConfig()
    try {
      const res = await fetch(`${config.dashboardUrl}/api/skills`, {
        headers: this.dashboardHeaders(),
        signal: AbortSignal.timeout(5000)
      })
      if (!res.ok) return []
      return await res.json()
    } catch {
      return []
    }
  }

  async toggleSkill(name: string, enabled: boolean): Promise<boolean> {
    const config = this.getConfig()
    try {
      const res = await fetch(`${config.dashboardUrl}/api/skills/toggle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...this.dashboardHeaders() },
        body: JSON.stringify({ name, enabled }),
        signal: AbortSignal.timeout(5000)
      })
      return res.ok
    } catch {
      return false
    }
  }

  // --- Sessions / Memory ---
  async getSessions(): Promise<any[]> {
    const config = this.getConfig()
    try {
      const res = await fetch(`${config.dashboardUrl}/api/sessions`, {
        headers: this.dashboardHeaders(),
        signal: AbortSignal.timeout(5000)
      })
      if (!res.ok) return []
      const data = await res.json()
      return Array.isArray(data) ? data : (data.sessions || [])
    } catch {
      return []
    }
  }

  async getSessionMessages(id: string): Promise<any[]> {
    const config = this.getConfig()
    try {
      const res = await fetch(`${config.dashboardUrl}/api/sessions/${id}/messages`, {
        headers: this.dashboardHeaders(),
        signal: AbortSignal.timeout(5000)
      })
      if (!res.ok) return []
      const data = await res.json()
      return Array.isArray(data) ? data : (data.messages || data.data || [])
    } catch {
      return []
    }
  }

  // --- Profiles ---
  async getProfiles(): Promise<any[]> {
    const config = this.getConfig()
    try {
      const res = await fetch(`${config.dashboardUrl}/api/profiles`, {
        headers: this.dashboardHeaders(),
        signal: AbortSignal.timeout(5000)
      })
      if (!res.ok) return []
      return await res.json()
    } catch {
      return []
    }
  }

  async getProfileSoul(name: string): Promise<string> {
    const config = this.getConfig()
    try {
      const res = await fetch(`${config.dashboardUrl}/api/profiles/${encodeURIComponent(name)}/soul`, {
        headers: this.dashboardHeaders(),
        signal: AbortSignal.timeout(5000)
      })
      if (!res.ok) return ''
      const data = await res.json()
      return data.content || ''
    } catch {
      return ''
    }
  }

  // --- Cron Jobs ---
  async getJobs(): Promise<any[]> {
    const config = this.getConfig()
    try {
      const res = await fetch(`${config.dashboardUrl}/api/jobs`, {
        headers: this.dashboardHeaders(),
        signal: AbortSignal.timeout(5000)
      })
      if (!res.ok) return []
      return await res.json()
    } catch {
      return []
    }
  }

  async createJob(job: { name: string; schedule: string; prompt: string; deliver?: string }): Promise<any> {
    const config = this.getConfig()
    try {
      const res = await fetch(`${config.dashboardUrl}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.dashboardHeaders() },
        body: JSON.stringify(job),
        signal: AbortSignal.timeout(5000)
      })
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }

  async deleteJob(id: string): Promise<boolean> {
    const config = this.getConfig()
    try {
      const res = await fetch(`${config.dashboardUrl}/api/jobs/${id}`, {
        method: 'DELETE',
        headers: this.dashboardHeaders(),
        signal: AbortSignal.timeout(5000)
      })
      return res.ok
    } catch {
      return false
    }
  }

  async toggleJob(id: string, action: 'pause' | 'resume' | 'run'): Promise<boolean> {
    const config = this.getConfig()
    try {
      const res = await fetch(`${config.dashboardUrl}/api/jobs/${id}/${action}`, {
        method: 'POST',
        headers: this.dashboardHeaders(),
        signal: AbortSignal.timeout(5000)
      })
      return res.ok
    } catch {
      return false
    }
  }

  async checkDashboard(): Promise<{ connected: boolean; error?: string }> {
    const config = this.getConfig()
    try {
      if (!this.sessionToken) {
        await this.fetchSessionToken()
      }
      const res = await fetch(`${config.dashboardUrl}/api/status`, {
        headers: this.dashboardHeaders(),
        signal: AbortSignal.timeout(5000)
      })
      return { connected: res.ok }
    } catch (err: any) {
      return { connected: false, error: err.message }
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.sessionId = ''
  }
}
