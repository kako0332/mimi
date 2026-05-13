import { BrowserWindow } from 'electron'
import Store from 'electron-store'
import { HermesClient } from './hermes'

interface HermesConfig {
  dashboardUrl: string
  apiKey: string
}

let abortController: AbortController | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let hermesClient: HermesClient | null = null

export function startEventListener(mainWindow: BrowserWindow | null, store: Store, client?: HermesClient): void {
  stopEventListener()

  if (client) hermesClient = client

  const config = store.store as unknown as HermesConfig
  const url = `${config.dashboardUrl}/api/events`
  abortController = new AbortController()

  async function connect() {
    try {
      const headers: Record<string, string> = {}
      const token = hermesClient?.getSessionToken()
      if (token) headers['X-Hermes-Session-Token'] = token

      const res = await fetch(url, {
        headers,
        signal: abortController!.signal
      })

      if (!res.ok || !res.body) {
        scheduleReconnect(mainWindow, store)
        return
      }

      const reader = res.body.getReader()
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
          try {
            const event = JSON.parse(data)
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('hermes:event', event)
            }
          } catch {
            // skip malformed
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        scheduleReconnect(mainWindow, store)
      }
    }
  }

  connect()
}

function scheduleReconnect(mainWindow: BrowserWindow | null, store: Store): void {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimer = setTimeout(() => {
    startEventListener(mainWindow, store)
  }, 15000)
}

export function stopEventListener(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (abortController) {
    abortController.abort()
    abortController = null
  }
}
