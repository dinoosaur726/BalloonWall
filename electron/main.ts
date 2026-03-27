import { fileURLToPath } from 'node:url'
import path from 'node:path'
import http from 'node:http'
import fs from 'node:fs'
import { WebSocketServer, WebSocket } from 'ws'
import Store from 'electron-store'
import { autoUpdater } from 'electron-updater'
const electron = require('electron')
const { app, ipcMain, BrowserWindow, dialog, shell } = electron
import type { IpcMainInvokeEvent } from 'electron'

const __dirname = path.resolve(path.dirname(fileURLToPath(import.meta.url)))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST
console.log('[Main] VITE_PUBLIC:', process.env.VITE_PUBLIC)

let win: any | null
let wss: WebSocketServer | null
let httpServer: http.Server | null

let currentState: { cards: any, stacks: any, settings: any, history: any } = {
  cards: {},
  stacks: {},
  settings: {},
  history: []
}

interface CustomBalloon {
  id: string
  amount: number
  imageDataUrl: string
  useForNormal: boolean
  useForAd: boolean
}

interface Settings {
  wsPort: number
  httpPort: number
  streamerId?: string
  signatureBalloons?: string
  customBalloons?: CustomBalloon[]
  streamerNameProfile?: string
  streamerUrlProfile?: string
  hasCompletedWelcome?: boolean
  autoAdd?: boolean
  minAmount?: number
  autoAddAd?: boolean
  minAmountAd?: number
  lastSeenPatchNotes?: string
}

const store = new Store<Settings>({
  defaults: {
    wsPort: 3005,
    httpPort: 3006,
    streamerId: '',
    signatureBalloons: '',
    customBalloons: [],
    streamerNameProfile: '',
    streamerUrlProfile: '',
    hasCompletedWelcome: false,
    autoAdd: true,
    minAmount: 0,
    autoAddAd: true,
    minAmountAd: 0,
    lastSeenPatchNotes: ''
  }
})

const MIME_MAP: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.map': 'application/json',
}

function startHttpServer(port: number) {
  if (httpServer) {
    httpServer.close()
    httpServer = null
  }

  const serveDir = VITE_DEV_SERVER_URL
    ? path.join(process.env.APP_ROOT!, 'dist')
    : RENDERER_DIST

  httpServer = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    let urlPath = req.url || '/'

    urlPath = urlPath.split('?')[0]

    if (urlPath === '/') urlPath = '/index.html'

    if (VITE_DEV_SERVER_URL) {
      const targetUrl = new URL(urlPath, VITE_DEV_SERVER_URL)

      const proxyReq = http.request(targetUrl.href, { method: 'GET' }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers)
        proxyRes.pipe(res)
      })
      proxyReq.on('error', () => {
        res.writeHead(502)
        res.end('Proxy Error')
      })
      proxyReq.end()
      return
    }

    const filePath = path.join(serveDir, urlPath)

    if (!filePath.startsWith(serveDir)) {
      res.writeHead(403)
      res.end('Forbidden')
      return
    }

    const ext = path.extname(filePath).toLowerCase()
    const contentType = MIME_MAP[ext] || 'application/octet-stream'

    fs.readFile(filePath, (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') {
          fs.readFile(path.join(serveDir, 'index.html'), (err2, indexData) => {
            if (err2) {
              res.writeHead(404)
              res.end('Not Found')
            } else {
              res.writeHead(200, { 'Content-Type': 'text/html' })
              res.end(indexData)
            }
          })
        } else {
          res.writeHead(500)
          res.end('Internal Server Error')
        }
        return
      }

      res.writeHead(200, { 'Content-Type': contentType })
      res.end(data)
    })
  })

  httpServer.listen(port, () => {
    console.log(`[Main] HTTP server started on port ${port} — OBS Browser Source: http://localhost:${port}`)
  })

  httpServer.on('error', (err: any) => {
    console.error('[Main] HTTP server error:', err)
  })
}

function broadcastToWsClients(type: string, payload: any) {
  if (!wss) return
  const message = JSON.stringify({ type, payload })
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message)
    }
  })
}

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

      ws.send(JSON.stringify({
        type: 'full-state',
        payload: currentState
      }))

      ws.on('message', (message) => {
        const msgStr = message.toString()
        console.log('Received:', msgStr)

        try {
          const parsed = JSON.parse(msgStr)
          if (parsed.type) {
            return
          }
        } catch {
        }

        if (msgStr.includes('/')) {
          const parts = msgStr.split('/')
          if (parts.length === 3) {
            const [typeStr, nickname, amountStr] = parts
            const amount = parseInt(amountStr, 10)
            const type = typeStr === 'Ad' ? 'Ad'
              : typeStr === 'Challenge' ? 'Challenge'
              : typeStr === 'Battle' ? 'Battle'
              : 'Normal'
            if (!isNaN(amount) && win) {
              win.webContents.send('new-donation', { type, nickname, amount })
            }
          } else if (parts.length === 2) {
            const [nickname, amountStr] = parts
            const amount = parseInt(amountStr, 10)
            if (!isNaN(amount) && win) {
              win.webContents.send('new-donation', { type: 'Normal', nickname, amount })
            }
          }
        }
      })
    })
  } catch (error) {
    console.error('Failed to start WebSocket server:', error)
  }
}

function createWindow() {
  const width = 1920
  const height = 1080

  win = new BrowserWindow({
    width,
    height,
    useContentSize: true,
    resizable: false,
    fullscreenable: false,
    x: 0,
    y: 0,
    icon: path.join(process.env.APP_ROOT!, 'build', 'icon.png'),
    frame: false,
    titleBarStyle: 'hidden',
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    alwaysOnTop: false,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false
    },
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}


ipcMain.handle('get-settings', () => {
  return store.store
})

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

  return `file://${result.filePaths[0]}`
})

ipcMain.handle('save-cropped-image', async (_event: IpcMainInvokeEvent, dataUrl: string) => {
  const matches = dataUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/)
  if (!matches || matches.length !== 3) {
    return null
  }

  const type = matches[1]
  const buffer = Buffer.from(matches[2], 'base64')

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

ipcMain.handle('fetch-image', async (_event: any, url: string) => {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString('base64')
    const mimeType = response.headers.get('content-type') || 'image/png'
    return `data:${mimeType};base64,${base64}`
  } catch (error) {
    console.error('[Main] Fetch image failed:', error)
    return null
  }
})

ipcMain.handle('set-settings', (_event: any, newSettings: Partial<Settings>) => {
  for (const [key, value] of Object.entries(newSettings)) {
    // @ts-ignore
    store.set(key, value)
  }

  if (newSettings.wsPort) {
    startWebSocketServer(newSettings.wsPort)
  }

  if (newSettings.httpPort) {
    startHttpServer(newSettings.httpPort)
  }

  return store.store
})

ipcMain.on('state-sync', (_event: any, state: any) => {
  currentState = state
  broadcastToWsClients('state-update', state)
})

ipcMain.on('log', (_event: any, message: any) => {
  console.log('[Renderer]', message)
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
  const wsPort = store.get('wsPort')
  const httpPort = store.get('httpPort')
  startWebSocketServer(wsPort)
  startHttpServer(httpPort)

  if (!VITE_DEV_SERVER_URL) {
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false

    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'dinoosaur726',
      repo: 'BalloonWall'
    })

    autoUpdater.on('update-available', (info: any) => {
      console.log('[AutoUpdater] Update available:', info.version)
      win?.webContents.send('update-available', {
        version: info.version,
        releaseNotes: info.releaseNotes
      })
    })

    autoUpdater.on('update-not-available', () => {
      console.log('[AutoUpdater] Already up to date')
      win?.webContents.send('update-not-available')
    })

    autoUpdater.on('download-progress', (progress: any) => {
      win?.webContents.send('update-progress', {
        percent: Math.round(progress.percent)
      })
    })

    autoUpdater.on('update-downloaded', () => {
      console.log('[AutoUpdater] Update downloaded, ready to install')
      win?.webContents.send('update-downloaded')
    })

    autoUpdater.on('error', (err: Error) => {
      console.error('[AutoUpdater] Error:', err.message)
    })

    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err: Error) => {
        console.error('[AutoUpdater] Check failed:', err.message)
      })
    }, 3000)
  }
})

ipcMain.on('download-update', () => {
  autoUpdater.downloadUpdate().catch((err: Error) => {
    console.error('[AutoUpdater] Download failed:', err.message)
  })
})

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall(false, true)
})

ipcMain.on('check-for-update', () => {
  autoUpdater.checkForUpdates().catch((err: Error) => {
    console.error('[AutoUpdater] Manual check failed:', err.message)
  })
})

ipcMain.on('open-external', (_event: any, url: string) => {
  shell.openExternal(url)
})
