import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // Streaming chat via MessagePort
  chatStream: (messages: { role: string; content: string }[]): MessagePort => {
    const { port1, port2 } = ipcRenderer.createMessageChannel()
    ipcRenderer.postMessage('hermes:chat-stream', messages, [port2])
    return port1
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
  }
}

contextBridge.exposeInMainWorld('api', api)
