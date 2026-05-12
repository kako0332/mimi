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
        dashboardUrl: string
        theme: string
      }>
      setSettings: (config: Record<string, any>) => Promise<void>
      setAlwaysOnTop: (flag: boolean) => Promise<void>
      minimizeToTray: () => Promise<void>
      onOpenSettings: (callback: () => void) => void
      checkDashboard: () => Promise<{ connected: boolean; error?: string }>
      listSkills: () => Promise<any[]>
      toggleSkill: (name: string, enabled: boolean) => Promise<boolean>
      listSessions: () => Promise<any[]>
      getSessionMessages: (id: string) => Promise<any[]>
      listProfiles: () => Promise<any[]>
      getProfileSoul: (name: string) => Promise<string>
      listJobs: () => Promise<any[]>
      createJob: (job: { name: string; schedule: string; prompt: string; deliver?: string }) => Promise<any>
      deleteJob: (id: string) => Promise<boolean>
      toggleJob: (id: string, action: 'pause' | 'resume' | 'run') => Promise<boolean>
      onHermesEvent: (callback: (event: any) => void) => void
      onMcpSetExpression: (callback: (data: { expression: string }) => void) => void
      onMcpNotification: (callback: (data: { title: string; message: string }) => void) => void
      onMcpMessage: (callback: (data: { content: string }) => void) => void
      onMcpChangeTheme: (callback: (data: { theme: string }) => void) => void
    }
  }
}
