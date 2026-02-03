import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { WebSocketServer } from 'ws'
import Store from 'electron-store'

// Standard CJS require for Electron
const electron = require('electron')
const { app, ipcMain, BrowserWindow, dialog } = electron
import type { IpcMainInvokeEvent } from 'electron'

// Resolve dirname for CJS/TS compatibility (Vite handles this)
const __dirname = path.resolve(path.dirname(fileURLToPath(import.meta.url)))

// The built directory structure
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: any | null
let wss: WebSocketServer | null

interface Settings {
  wsPort: number
  amountRanges: { min: number; max: number; imageUrl: string }[]
  isTransparent?: boolean
}

const store = new Store<Settings>({
  defaults: {
    wsPort: 3005,
    amountRanges: [
      { min: 0, max: 99, imageUrl: 'default' },
      { min: 100, max: 999, imageUrl: 'bronze' },
      { min: 1000, max: 9999, imageUrl: 'silver' },
      { min: 10000, max: 999999, imageUrl: 'gold' }
    ]
  }
})

function startWebSocketServer(port: number) {
  if (wss) {
    wss.close()
    wss = null
  }
  try {
    wss = new WebSocketServer({ port })
    console.log(`WebSocket server started on port ${port}`)

    wss.on('connection', (ws) => {
      console.log('Client connected')
      ws.on('message', (message) => {
        const msgStr = message.toString()
        console.log('Received:', msgStr)
        // Format: "Nickname/Amount"
        if (msgStr.includes('/')) {
          const [nickname, amountStr] = msgStr.split('/')
          const amount = parseInt(amountStr, 10)
          if (!isNaN(amount) && win) {
            win.webContents.send('new-donation', { nickname, amount })
          }
        }
      })
    })
  } catch (error) {
    console.error('Failed to start WebSocket server:', error)
  }
}

function createWindow() {
  const width = 1280
  const height = 720

  win = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    frame: false, // Frameless for clean OBS capture
    titleBarStyle: 'hidden', // Hide title bar on Mac
    transparent: true, // Keep transparency support
    backgroundColor: '#00000000', // Explicitly transparent (ARGB) to prevent grey/white ghosting
    hasShadow: false,
    alwaysOnTop: false, // User requested standard window
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false // Allow loading local resources (file://)
      // contextIsolation: true, // default true
      // nodeIntegration: false, // default false
    },
  })

  // Make click-through for background but not for interactive elements? 
  // Electron basic click-through: win.setIgnoreMouseEvents(true, { forward: true })
  // Renderer needs to handle mouse enter/leave to toggle ignore mouse events.
  // For now, let's keep it interactive everywhere to test Drag & Drop comfortably.
  // win.setIgnoreMouseEvents(false)

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}


ipcMain.handle('get-settings', () => {
  return store.store
})

import fs from 'node:fs'

// ... existing code ...

ipcMain.handle('select-image', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'png', 'gif', 'webp', 'jpeg'] }
    ]
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  // Return file:// URL for renderer usage
  return `file://${result.filePaths[0]}`
})

// Save Base64 Data URL to Disk
ipcMain.handle('save-cropped-image', async (_event: IpcMainInvokeEvent, dataUrl: string) => {
  // data:image/png;base64,...
  const matches = dataUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/)
  if (!matches || matches.length !== 3) {
    return null
  }

  const type = matches[1]
  const buffer = Buffer.from(matches[2], 'base64')

  // Save to App Data Directory
  const userDataPath = app.getPath('userData')
  const fileName = `cropped_${Date.now()}.${type}`
  const filePath = path.join(userDataPath, fileName)

  try {
    await fs.promises.writeFile(filePath, buffer)
    return `file://${filePath}`
  } catch (err) {
    console.error('Failed to save cropped image:', err)
    return null
  }
})

ipcMain.handle('set-settings', (_event: any, newSettings: Partial<Settings>) => {
  // electron-store set(object) requires full object or matching. Partial causes issue.
  // Iterating to set individual keys is safer for Partial updates.
  for (const [key, value] of Object.entries(newSettings)) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    store.set(key, value)
  }

  if (newSettings.wsPort) {
    startWebSocketServer(newSettings.wsPort)
  }
  return store.store
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  createWindow()
  const port = store.get('wsPort')
  startWebSocketServer(port)
})
