import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // Hermes chat - returns an async iterable via message channel
  chat: (messages: { role: string; content: string }[]): Promise<void> => {
    return ipcRenderer.invoke('hermes:chat', messages)
  },

  // Streaming chat via MessagePort
  chatStream: (messages: { role: string; content: string }[]): NodeJS.ReadWriteStream => {
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
  }
}

contextBridge.exposeInMainWorld('api', api)
