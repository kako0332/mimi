import { contextBridge, ipcRenderer } from 'electron'

const api = {
  chatStream: (text: string, onChunk: (chunk: any) => void): void => {
    const id = `${Date.now()}-${Math.random()}`
    const channel = `hermes:chunk:${id}`
    const handler = (_e: any, chunk: any) => {
      onChunk(chunk)
      if (chunk.type === 'done' || chunk.type === 'error') {
        ipcRenderer.removeListener(channel, handler)
      }
    }
    ipcRenderer.on(channel, handler)
    ipcRenderer.send('hermes:chat-start', { id, text })
  },

  checkConnection: (): Promise<{ connected: boolean; error?: string }> => {
    return ipcRenderer.invoke('hermes:check-connection')
  },

  getSettings: (): Promise<any> => {
    return ipcRenderer.invoke('settings:get')
  },

  setSettings: (config: any): Promise<void> => {
    return ipcRenderer.invoke('settings:set', config)
  },

  setAlwaysOnTop: (flag: boolean): Promise<void> => {
    return ipcRenderer.invoke('window:set-always-on-top', flag)
  },

  minimizeToTray: (): Promise<void> => {
    return ipcRenderer.invoke('window:minimize-to-tray')
  },

  onOpenSettings: (callback: () => void) => {
    ipcRenderer.on('open-settings', () => callback())
  },

  // Dashboard
  checkDashboard: (): Promise<{ connected: boolean; error?: string }> => {
    return ipcRenderer.invoke('dashboard:check')
  },

  // Skills
  listSkills: (): Promise<any[]> => {
    return ipcRenderer.invoke('skills:list')
  },

  toggleSkill: (name: string, enabled: boolean): Promise<boolean> => {
    return ipcRenderer.invoke('skills:toggle', name, enabled)
  },

  // Sessions
  listSessions: (): Promise<any[]> => {
    return ipcRenderer.invoke('sessions:list')
  },

  getSessionMessages: (id: string): Promise<any[]> => {
    return ipcRenderer.invoke('sessions:messages', id)
  },

  // Profiles
  listProfiles: (): Promise<any[]> => {
    return ipcRenderer.invoke('profiles:list')
  },

  getProfileSoul: (name: string): Promise<string> => {
    return ipcRenderer.invoke('profiles:soul', name)
  },

  // Cron Jobs
  listJobs: (): Promise<any[]> => {
    return ipcRenderer.invoke('jobs:list')
  },

  createJob: (job: { name: string; schedule: string; prompt: string; deliver?: string }): Promise<any> => {
    return ipcRenderer.invoke('jobs:create', job)
  },

  deleteJob: (id: string): Promise<boolean> => {
    return ipcRenderer.invoke('jobs:delete', id)
  },

  toggleJob: (id: string, action: 'pause' | 'resume' | 'run'): Promise<boolean> => {
    return ipcRenderer.invoke('jobs:toggle', id, action)
  },

  // Event listeners (hermes events + MCP)
  onHermesEvent: (callback: (event: any) => void) => {
    ipcRenderer.on('hermes:event', (_e, data) => callback(data))
  },

  onMcpSetExpression: (callback: (data: { expression: string }) => void) => {
    ipcRenderer.on('mcp:set-expression', (_e, data) => callback(data))
  },

  onMcpNotification: (callback: (data: { title: string; message: string }) => void) => {
    ipcRenderer.on('mcp:notification', (_e, data) => callback(data))
  },

  onMcpMessage: (callback: (data: { content: string }) => void) => {
    ipcRenderer.on('mcp:message', (_e, data) => callback(data))
  },

  onMcpChangeTheme: (callback: (data: { theme: string }) => void) => {
    ipcRenderer.on('mcp:change-theme', (_e, data) => callback(data))
  }
}

contextBridge.exposeInMainWorld('api', api)
