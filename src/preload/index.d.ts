import { IPC } from '@electron-toolkit/preload'

declare global {
  interface Window {
    api: {
      chatStream: (messages: { role: string; content: string }[]) => MessagePort
      checkConnection: () => Promise<{ connected: boolean; error?: string }>
      getSettings: () => Promise<{
        apiUrl: string
        apiKey: string
        alwaysOnTop: boolean
        autoStart: boolean
      }>
      setSettings: (config: {
        apiUrl: string
        apiKey: string
        alwaysOnTop: boolean
        autoStart: boolean
      }) => Promise<void>
      setAlwaysOnTop: (flag: boolean) => Promise<void>
      minimizeToTray: () => Promise<void>
      onOpenSettings: (callback: () => void) => void
    }
  }
}
