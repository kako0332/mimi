import { createContext, useContext, useReducer, useEffect, useCallback, type ReactNode } from 'react'

type Expression = 'idle' | 'happy' | 'talking' | 'sad' | 'thinking' | 'sleeping'

export interface Message {
  role: 'user' | 'assistant' | 'error'
  content: string
}

interface AppState {
  connected: boolean
  expression: Expression
  messages: Message[]
  isStreaming: boolean
}

type Action =
  | { type: 'SET_CONNECTED'; connected: boolean }
  | { type: 'SET_EXPRESSION'; expression: Expression }
  | { type: 'ADD_MESSAGE'; message: Message }
  | { type: 'APPEND_LAST_MESSAGE'; content: string }
  | { type: 'SET_STREAMING'; streaming: boolean }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_CONNECTED':
      return {
        ...state,
        connected: action.connected,
        expression: action.connected
          ? (state.expression === 'sad' ? 'idle' : state.expression)
          : 'sad'
      }
    case 'SET_EXPRESSION':
      return { ...state, expression: action.expression }
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.message] }
    case 'APPEND_LAST_MESSAGE': {
      const msgs = [...state.messages]
      const last = msgs[msgs.length - 1]
      if (last && last.role === 'assistant') {
        msgs[msgs.length - 1] = { ...last, content: last.content + action.content }
      }
      return { ...state, messages: msgs }
    }
    case 'SET_STREAMING':
      return {
        ...state,
        isStreaming: action.streaming,
        expression: action.streaming ? 'talking' : 'idle'
      }
  }
}

interface AppContextValue {
  state: AppState
  send: (text: string) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    connected: false,
    expression: 'idle',
    messages: [],
    isStreaming: false
  })

  // Connection check
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>

    async function check() {
      try {
        const result = await window.api.checkConnection()
        dispatch({ type: 'SET_CONNECTED', connected: result.connected })
      } catch {
        dispatch({ type: 'SET_CONNECTED', connected: false })
      }
    }

    check()
    timer = setInterval(check, 10000)
    return () => clearInterval(timer)
  }, [])

  // Tray menu "open settings"
  useEffect(() => {
    window.api.onOpenSettings(() => {
      // Handled via App component re-render
    })
  }, [])

  const send = useCallback(async (text: string) => {
    if (!text.trim() || state.isStreaming) return

    dispatch({ type: 'ADD_MESSAGE', message: { role: 'user', content: text } })
    dispatch({ type: 'ADD_MESSAGE', message: { role: 'assistant', content: '' } })
    dispatch({ type: 'SET_STREAMING', streaming: true })
    dispatch({ type: 'SET_EXPRESSION', expression: 'talking' })

    const messages = [...state.messages, { role: 'user' as const, content: text }]
    const port = window.api.chatStream(messages)

    port.onmessage = (e: MessageEvent) => {
      const chunk = e.data as { type: string; content: string }
      if (chunk.type === 'text') {
        dispatch({ type: 'APPEND_LAST_MESSAGE', content: chunk.content })
      } else if (chunk.type === 'error') {
        dispatch({ type: 'ADD_MESSAGE', message: { role: 'error', content: chunk.content } })
      } else if (chunk.type === 'done') {
        dispatch({ type: 'SET_STREAMING', streaming: false })
        port.close()
      }
    }

    port.onerror = () => {
      dispatch({ type: 'SET_STREAMING', streaming: false })
      dispatch({ type: 'SET_CONNECTED', connected: false })
    }

    port.start()
  }, [state.messages, state.isStreaming])

  return (
    <AppContext.Provider value={{ state, send }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppState() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppState must be used within AppProvider')
  return ctx
}
