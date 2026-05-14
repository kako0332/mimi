import { createContext, useContext, useReducer, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { getModelById, DEFAULT_MODEL, type ModelInfo } from '../config/models'

export type Expression = 'idle' | 'happy' | 'talking' | 'sad' | 'thinking' | 'sleeping'

export interface ToolCall {
  id: string
  name: string
  status: 'running' | 'done' | 'error'
  args?: string
  result?: string
}

export interface Message {
  role: 'user' | 'assistant' | 'error'
  content: string
  toolCalls?: ToolCall[]
}

export interface Skill {
  name: string
  enabled: boolean
}

export interface CronJob {
  id: string
  name: string
  schedule: string
  prompt: string
  enabled?: boolean
}

export interface PetNotification {
  title: string
  message: string
  timestamp: number
}

interface AppState {
  connected: boolean
  expression: Expression
  messages: Message[]
  isStreaming: boolean
  theme: string
  dashboardConnected: boolean
  skills: Skill[]
  sessions: any[]
  jobs: CronJob[]
  notifications: PetNotification[]
  live2dModelUrl: string
  live2dModelId: string
  retrying: boolean
  retryAttempt: number
}

type Action =
  | { type: 'SET_CONNECTED'; connected: boolean }
  | { type: 'SET_EXPRESSION'; expression: Expression }
  | { type: 'ADD_MESSAGE'; message: Message }
  | { type: 'APPEND_LAST_MESSAGE'; content: string }
  | { type: 'ADD_TOOL_CALL'; toolCall: ToolCall }
  | { type: 'UPDATE_TOOL_CALL'; id: string; status: ToolCall['status']; result?: string }
  | { type: 'UPDATE_TOOL_CALL_BY_NAME'; name: string; status: ToolCall['status']; result?: string }
  | { type: 'SET_STREAMING'; streaming: boolean }
  | { type: 'SET_THEME'; theme: string }
  | { type: 'SET_DASHBOARD_CONNECTED'; connected: boolean }
  | { type: 'SET_SKILLS'; skills: Skill[] }
  | { type: 'TOGGLE_SKILL'; name: string; enabled: boolean }
  | { type: 'SET_SESSIONS'; sessions: any[] }
  | { type: 'SET_JOBS'; jobs: CronJob[] }
  | { type: 'ADD_NOTIFICATION'; notification: PetNotification }
  | { type: 'CLEAR_NOTIFICATIONS' }
  | { type: 'SET_LIVE2D_MODEL'; url: string }
  | { type: 'SET_LIVE2D_MODEL_ID'; id: string }
  | { type: 'SET_RETRYING'; retrying: boolean; attempt?: number }

// Expression sync: analyze response text for keywords
function detectExpression(text: string, current: Expression): Expression {
  const lower = text.toLowerCase()
  if (/哈哈|开心|高兴|快乐|太好了|棒|厉害|不错|嘿嘿|耶|happy|great|awesome|wonderful|lol/.test(lower)) return 'happy'
  if (/难过|抱歉|遗憾|可惜|伤心|对不起|sad|sorry|unfortunately/.test(lower)) return 'sad'
  if (/嗯|让我想想|思考|hmm|think|consider|let me/.test(lower)) return 'thinking'
  // Default: keep talking while streaming
  return current === 'talking' ? 'talking' : 'idle'
}

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
      return {
        ...state,
        messages: msgs,
        expression: detectExpression(action.content, state.expression)
      }
    }
    case 'ADD_TOOL_CALL': {
      const msgs = [...state.messages]
      const last = msgs[msgs.length - 1]
      if (last && last.role === 'assistant') {
        msgs[msgs.length - 1] = {
          ...last,
          toolCalls: [...(last.toolCalls || []), action.toolCall]
        }
      }
      return { ...state, messages: msgs }
    }
    case 'UPDATE_TOOL_CALL': {
      const msgs = [...state.messages]
      const last = msgs[msgs.length - 1]
      if (last && last.role === 'assistant' && last.toolCalls) {
        msgs[msgs.length - 1] = {
          ...last,
          toolCalls: last.toolCalls.map(tc =>
            tc.id === action.id ? { ...tc, status: action.status, result: action.result } : tc
          )
        }
      }
      return { ...state, messages: msgs }
    }
    case 'UPDATE_TOOL_CALL_BY_NAME': {
      const msgs = [...state.messages]
      const last = msgs[msgs.length - 1]
      if (last && last.role === 'assistant' && last.toolCalls) {
        // Find the last running tool with this name
        let updated = false
        const newCalls = [...last.toolCalls].reverse().map(tc => {
          if (!updated && tc.name === action.name && tc.status === 'running') {
            updated = true
            return { ...tc, status: action.status, result: action.result }
          }
          return tc
        }).reverse()
        msgs[msgs.length - 1] = { ...last, toolCalls: newCalls }
      }
      return { ...state, messages: msgs }
    }
    case 'SET_STREAMING':
      return {
        ...state,
        isStreaming: action.streaming,
        expression: action.streaming ? 'talking' : 'idle'
      }
    case 'SET_THEME':
      return { ...state, theme: action.theme }
    case 'SET_DASHBOARD_CONNECTED':
      return { ...state, dashboardConnected: action.connected }
    case 'SET_SKILLS':
      return { ...state, skills: action.skills }
    case 'TOGGLE_SKILL':
      return {
        ...state,
        skills: state.skills.map(s => s.name === action.name ? { ...s, enabled: action.enabled } : s)
      }
    case 'SET_SESSIONS':
      return { ...state, sessions: action.sessions }
    case 'SET_JOBS':
      return { ...state, jobs: action.jobs }
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [...state.notifications, action.notification].slice(-10)
      }
    case 'CLEAR_NOTIFICATIONS':
      return { ...state, notifications: [] }
    case 'SET_LIVE2D_MODEL':
      return { ...state, live2dModelUrl: action.url }
    case 'SET_LIVE2D_MODEL_ID':
      return { ...state, live2dModelId: action.id }
    case 'SET_RETRYING':
      return { ...state, retrying: action.retrying, retryAttempt: action.attempt ?? state.retryAttempt }
  }
}

interface AppContextValue {
  state: AppState
  send: (text: string) => void
  refreshSkills: () => Promise<void>
  refreshSessions: () => Promise<void>
  refreshJobs: () => Promise<void>
  setTheme: (theme: string) => void
  setModel: (model: ModelInfo) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    connected: false,
    expression: 'idle',
    messages: [],
    isStreaming: false,
    theme: 'blue',
    dashboardConnected: false,
    skills: [],
    sessions: [],
    jobs: [],
    notifications: [],
    live2dModelUrl: DEFAULT_MODEL.url,
    live2dModelId: DEFAULT_MODEL.id,
    retrying: false,
    retryAttempt: 0
  })

  useEffect(() => {
    if (!window.api) {
      console.warn('[AppContext] window.api not available — running outside Electron?')
      return
    }
    window.api.checkConnection()
      .then(result => {
        dispatch({ type: 'SET_CONNECTED', connected: result.connected })
      })
      .catch(err => {
        console.warn('[AppContext] checkConnection failed:', err)
        dispatch({ type: 'SET_CONNECTED', connected: false })
      })

    // Load persisted model selection
    window.api.getSettings()
      .then((cfg: any) => {
        if (cfg?.live2dModel) {
          const model = getModelById(cfg.live2dModel)
          if (model) {
            dispatch({ type: 'SET_LIVE2D_MODEL', url: model.url })
            dispatch({ type: 'SET_LIVE2D_MODEL_ID', id: model.id })
          }
        }
        if (cfg?.theme) {
          dispatch({ type: 'SET_THEME', theme: cfg.theme })
        }
      })
      .catch(() => { /* ignore */ })
  }, [])

  const retryingRef = useRef(false)

  const send = useCallback(async (text: string) => {
    if (!text.trim() || state.isStreaming || !window.api) return

    dispatch({ type: 'ADD_MESSAGE', message: { role: 'user', content: text } })
    dispatch({ type: 'ADD_MESSAGE', message: { role: 'assistant', content: '' } })
    dispatch({ type: 'SET_STREAMING', streaming: true })
    dispatch({ type: 'SET_EXPRESSION', expression: 'talking' })

    const MAX_RETRIES = 5
    const BACKOFF = [5000, 10000, 20000, 30000, 60000]
    const RATE_LIMIT_PATTERN = /访问量过大|rate.?limit|too many requests|overloaded|429|capacity|quota|请稍后|请稍候|请稍等|繁忙/i

    let attempt = 0

    const doStream = () => {
      window.api.chatStream(text, (chunk: { type: string; content: string }) => {
        if (chunk.type === 'text') {
          dispatch({ type: 'APPEND_LAST_MESSAGE', content: chunk.content })
        } else if (chunk.type === 'tool_start') {
          try {
            const tool = JSON.parse(chunk.content)
            dispatch({ type: 'ADD_TOOL_CALL', toolCall: { id: tool.id, name: tool.name, status: 'running', args: tool.context } })
          } catch { /* ignore */ }
        } else if (chunk.type === 'tool_complete') {
          try {
            const tool = JSON.parse(chunk.content)
            dispatch({ type: 'UPDATE_TOOL_CALL', id: tool.id, status: 'done', result: tool.summary })
          } catch { /* ignore */ }
        } else if (chunk.type === 'error') {
          const isRateLimit = RATE_LIMIT_PATTERN.test(chunk.content)

          if (isRateLimit && attempt < MAX_RETRIES) {
            attempt++
            const delay = BACKOFF[Math.min(attempt - 1, BACKOFF.length - 1)]
            retryingRef.current = true
            dispatch({ type: 'SET_RETRYING', retrying: true, attempt })
            dispatch({ type: 'SET_EXPRESSION', expression: 'thinking' })

            setTimeout(() => {
              dispatch({ type: 'ADD_MESSAGE', message: { role: 'error', content: `⏳ 模型繁忙，第 ${attempt} 次重试中...` } })
              dispatch({ type: 'ADD_MESSAGE', message: { role: 'assistant', content: '' } })
              dispatch({ type: 'SET_STREAMING', streaming: true })
              doStream()
            }, delay)
          } else {
            retryingRef.current = false
            dispatch({ type: 'SET_RETRYING', retrying: false })
            dispatch({ type: 'ADD_MESSAGE', message: { role: 'error', content: chunk.content } })
            dispatch({ type: 'SET_STREAMING', streaming: false })
          }
        } else if (chunk.type === 'done') {
          if (!retryingRef.current) {
            dispatch({ type: 'SET_STREAMING', streaming: false })
          }
          dispatch({ type: 'SET_RETRYING', retrying: false })
          retryingRef.current = false
        }
      })
    }

    doStream()
  }, [state.isStreaming])

  const refreshSkills = useCallback(async () => {
    if (!window.api) return
    const skills = await window.api.listSkills()
    dispatch({ type: 'SET_SKILLS', skills: skills.map((s: any) => ({ name: s.name, enabled: s.enabled })) })
  }, [])

  const refreshSessions = useCallback(async () => {
    if (!window.api) return
    const sessions = await window.api.listSessions()
    dispatch({ type: 'SET_SESSIONS', sessions })
  }, [])

  const refreshJobs = useCallback(async () => {
    if (!window.api) return
    const jobs = await window.api.listJobs()
    dispatch({ type: 'SET_JOBS', jobs: jobs.map((j: any) => ({
      id: j.id || j.name,
      name: j.name,
      schedule: j.schedule,
      prompt: j.prompt,
      enabled: j.enabled
    })) })
  }, [])

  const setTheme = useCallback(async (theme: string) => {
    dispatch({ type: 'SET_THEME', theme })
    if (window.api) await window.api.setSettings({ theme })
  }, [])

  const setModel = useCallback(async (model: ModelInfo) => {
    dispatch({ type: 'SET_LIVE2D_MODEL', url: model.url })
    dispatch({ type: 'SET_LIVE2D_MODEL_ID', id: model.id })
    if (window.api) await window.api.setSettings({ live2dModel: model.id })
  }, [])

  return (
    <AppContext.Provider value={{ state, send, refreshSkills, refreshSessions, refreshJobs, setTheme, setModel }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppState() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppState must be used within AppProvider')
  return ctx
}
