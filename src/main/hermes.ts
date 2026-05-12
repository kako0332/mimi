import Store from 'electron-store'

interface HermesConfig {
  apiUrl: string
  apiKey: string
  alwaysOnTop: boolean
  autoStart: boolean
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
    autoStart: false
  }
})

export class HermesClient {
  getConfig(): HermesConfig {
    return {
      apiUrl: store.get('apiUrl'),
      apiKey: store.get('apiKey'),
      alwaysOnTop: store.get('alwaysOnTop'),
      autoStart: store.get('autoStart')
    }
  }

  setConfig(config: Partial<HermesConfig>): void {
    for (const [key, value] of Object.entries(config)) {
      store.set(key as keyof HermesConfig, value)
    }
  }

  async checkConnection(): Promise<{ connected: boolean; error?: string }> {
    const config = this.getConfig()
    try {
      const headers: Record<string, string> = {}
      if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`

      const res = await fetch(`${config.apiUrl}/models`, {
        method: 'GET',
        headers,
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
      'Content-Type': 'application/json'
    }
    if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`

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
}
