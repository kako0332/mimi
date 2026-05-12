import Store from 'electron-store'

interface HermesConfig {
  apiUrl: string
  apiKey: string
  alwaysOnTop: boolean
  autoStart: boolean
  dashboardUrl: string
  theme: string
}

interface ChatChunk {
  type: 'text' | 'tool' | 'done' | 'error'
  content: string
}

const store = new Store<HermesConfig>({
  defaults: {
    apiUrl: 'http://localhost:8642/v1',
    apiKey: '',
    alwaysOnTop: true,
    autoStart: false,
    dashboardUrl: 'http://localhost:9119',
    theme: 'blue'
  }
})

export class HermesClient {
  getConfig(): HermesConfig {
    return {
      apiUrl: store.get('apiUrl'),
      apiKey: store.get('apiKey'),
      alwaysOnTop: store.get('alwaysOnTop'),
      autoStart: store.get('autoStart'),
      dashboardUrl: store.get('dashboardUrl'),
      theme: store.get('theme')
    }
  }

  setConfig(config: Partial<HermesConfig>): void {
    for (const [key, value] of Object.entries(config)) {
      if (value !== undefined) {
        store.set(key as keyof HermesConfig, value)
      }
    }
  }

  private authHeaders(): Record<string, string> {
    const config = this.getConfig()
    const headers: Record<string, string> = {}
    if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`
    return headers
  }

  async checkConnection(): Promise<{ connected: boolean; error?: string }> {
    const config = this.getConfig()
    try {
      const res = await fetch(`${config.apiUrl}/models`, {
        method: 'GET',
        headers: this.authHeaders(),
        signal: AbortSignal.timeout(5000)
      })
      return { connected: res.ok }
    } catch (err: any) {
      return { connected: false, error: err.message }
    }
  }

  async checkDashboard(): Promise<{ connected: boolean; error?: string }> {
    const config = this.getConfig()
    try {
      const res = await fetch(`${config.dashboardUrl}/api/skills`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })
      return { connected: res.ok }
    } catch (err: any) {
      return { connected: false, error: err.message }
    }
  }

  async *chat(messages: { role: string; content: string }[]): AsyncGenerator<ChatChunk> {
    const config = this.getConfig()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.authHeaders()
    }

    try {
      const res = await fetch(`${config.apiUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'hermes',
          messages,
          stream: true,
          conversation: 'desktop-pet'
        })
      })

      if (!res.ok) {
        yield { type: 'error', content: `API error: ${res.status} ${res.statusText}` }
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)
          if (data === '[DONE]') {
            yield { type: 'done', content: '' }
            return
          }

          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta
            if (delta?.content) {
              yield { type: 'text', content: delta.content }
            }
          } catch {
            // skip malformed JSON lines
          }
        }
      }

      yield { type: 'done', content: '' }
    } catch (err: any) {
      yield { type: 'error', content: err.message }
    }
  }

  // --- Skills ---
  async getSkills(): Promise<any[]> {
    const config = this.getConfig()
    try {
      const res = await fetch(`${config.dashboardUrl}/api/skills`, {
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
        headers: { 'Content-Type': 'application/json' },
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
        signal: AbortSignal.timeout(5000)
      })
      if (!res.ok) return []
      return await res.json()
    } catch {
      return []
    }
  }

  async getSessionMessages(id: string): Promise<any[]> {
    const config = this.getConfig()
    try {
      const res = await fetch(`${config.dashboardUrl}/api/sessions/${id}/messages`, {
        signal: AbortSignal.timeout(5000)
      })
      if (!res.ok) return []
      return await res.json()
    } catch {
      return []
    }
  }

  // --- Profiles ---
  async getProfiles(): Promise<any[]> {
    const config = this.getConfig()
    try {
      const res = await fetch(`${config.dashboardUrl}/api/profiles`, {
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
      const res = await fetch(`${config.apiUrl.replace('/v1', '')}/api/jobs`, {
        headers: this.authHeaders(),
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
      const res = await fetch(`${config.apiUrl.replace('/v1', '')}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
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
      const res = await fetch(`${config.apiUrl.replace('/v1', '')}/api/jobs/${id}`, {
        method: 'DELETE',
        headers: this.authHeaders(),
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
      const res = await fetch(`${config.apiUrl.replace('/v1', '')}/api/jobs/${id}/${action}`, {
        method: 'POST',
        headers: this.authHeaders(),
        signal: AbortSignal.timeout(5000)
      })
      return res.ok
    } catch {
      return false
    }
  }
}
