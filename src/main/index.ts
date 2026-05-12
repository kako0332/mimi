import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen } from 'electron'
import { join } from 'path'
import { electronApp } from '@electron-toolkit/utils'
import { HermesClient } from './hermes'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

const hermes = new HermesClient()

function createWindow(): void {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width: 300,
    height: 350,
    x: screenW - 350,
    y: screenH - 400,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.setVisibleOnAllWorkspaces(true)

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('Renderer gone:', details)
  })
}

function createTray(): void {
  const iconPath = join(__dirname, '../../assets/tray-icon.png')
  const icon = nativeImage.createFromPath(iconPath)
  tray = new Tray(icon)
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示', click: () => mainWindow?.show() },
    { label: '设置', click: () => mainWindow?.webContents.send('open-settings') },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ])
  tray.setToolTip('Desktop Pet')
  tray.setContextMenu(contextMenu)
  tray.on('click', () => mainWindow?.show())
}

// --- IPC Handlers ---

ipcMain.on('hermes:chat-stream', (event, messages: { role: string; content: string }[]) => {
  const [port] = event.ports
  ;(async () => {
    for await (const chunk of hermes.chat(messages)) {
      port.postMessage(chunk)
    }
    port.close()
  })()
})

ipcMain.handle('hermes:check-connection', async () => {
  return hermes.checkConnection()
})

ipcMain.handle('settings:get', () => {
  return hermes.getConfig()
})

ipcMain.handle('settings:set', (_e, config: { apiUrl: string; apiKey: string; alwaysOnTop: boolean; autoStart: boolean }) => {
  hermes.setConfig(config)
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(config.alwaysOnTop)
  }
  app.setLoginItemSettings({ openAtLogin: config.autoStart })
})

ipcMain.handle('window:set-always-on-top', (_e, flag: boolean) => {
  mainWindow?.setAlwaysOnTop(flag)
})

ipcMain.handle('window:minimize-to-tray', () => {
  mainWindow?.hide()
})

// --- App Lifecycle ---

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.desktop-pet')

  createWindow()
  createTray()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
