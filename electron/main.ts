import { fileURLToPath } from 'node:url'
import path from 'node:path'
import http from 'node:http'
import fs from 'node:fs'
import { WebSocketServer, WebSocket } from 'ws'
import Store from 'electron-store'
import { autoUpdater } from 'electron-updater'

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
console.log('[Main] VITE_PUBLIC:', process.env.VITE_PUBLIC)

let win: any | null
let wss: WebSocketServer | null
let httpServer: http.Server | null

// ─── Current State Cache (for sync to browser clients) ───
let currentState: { cards: any, stacks: any, settings: any, history: any } = {
  cards: {},
  stacks: {},
  settings: {},
  history: []
}

interface Settings {
  wsPort: number
  httpPort: number
  streamerId?: string
  signatureBalloons?: string
  autoAdd?: boolean
  minAmount?: number
}

const store = new Store<Settings>({
  defaults: {
    wsPort: 3005,
    httpPort: 3006,
    streamerId: '',
    signatureBalloons: '',
    autoAdd: true,
    minAmount: 0
  }
})

// ─── MIME Type Helper ───
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

// ─── HTTP Static File Server (for OBS Browser Source) ───
function startHttpServer(port: number) {
  if (httpServer) {
    httpServer.close()
    httpServer = null
  }

  // Determine the directory to serve
  const serveDir = VITE_DEV_SERVER_URL
    ? path.join(process.env.APP_ROOT!, 'dist') // Fallback; in dev mode, we proxy to Vite
    : RENDERER_DIST

  httpServer = http.createServer((req, res) => {
    // Add CORS headers for OBS browser source
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    let urlPath = req.url || '/'

    // Remove query strings
    urlPath = urlPath.split('?')[0]

    // Default to index.html
    if (urlPath === '/') urlPath = '/index.html'

    // In dev mode, proxy to Vite dev server
    if (VITE_DEV_SERVER_URL) {
      // Proxy requests to Vite dev server
      const targetUrl = new URL(urlPath, VITE_DEV_SERVER_URL)

      // Use dynamic import for http proxy-like behavior
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

    // Production: serve static files
    const filePath = path.join(serveDir, urlPath)

    // Security: prevent path traversal
    if (!filePath.startsWith(serveDir)) {
      res.writeHead(403)
      res.end('Forbidden')
      return
    }

    const ext = path.extname(filePath).toLowerCase()
    const contentType = MIME_MAP[ext] || 'application/octet-stream'

    fs.readFile(filePath, (err, data) => {
      if (err) {
        // SPA fallback: serve index.html for non-file routes
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

// ─── Broadcast state to all WebSocket clients ───
function broadcastToWsClients(type: string, payload: any) {
  if (!wss) return
  const message = JSON.stringify({ type, payload })
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message)
    }
  })
}

// ─── WebSocket Server ───
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

      // Send current state to newly connected client (for OBS browser source sync)
      ws.send(JSON.stringify({
        type: 'full-state',
        payload: currentState
      }))

      ws.on('message', (message) => {
        const msgStr = message.toString()
        console.log('Received:', msgStr)

        // Try parsing as JSON first (for structured messages)
        try {
          const parsed = JSON.parse(msgStr)
          // Handle structured messages if needed in the future
          if (parsed.type) {
            return
          }
        } catch {
          // Not JSON, try legacy format
        }

        // Legacy Format: "Nickname/Amount"
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
  const width = 1920
  const height = 1080

  win = new BrowserWindow({
    width,
    height,
    useContentSize: true, // Ensure viewport is exactly 1920x1080
    resizable: false,     // Disable resizing by user
    fullscreenable: false, // Prevent maximizing
    x: 0,
    y: 0,
    icon: path.join(process.env.APP_ROOT!, 'build', 'icon.png'),
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

// Save Base64 Data URL to Disk
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

// ─── State Sync: Renderer → Main → WS Clients ───
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

  // ─── Auto-Update (production only) ───
  if (!VITE_DEV_SERVER_URL) {
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false

    // Set feed URL with token for private repo access
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'dinoosaur726',
      repo: 'BalloonWall',
      private: true,
      token: process.env.GH_TOKEN || ''
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

    // Check after 3 seconds to not block startup
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err: Error) => {
        console.error('[AutoUpdater] Check failed:', err.message)
      })
    }, 3000)
  }
})

// ─── Auto-Update IPC Handlers ───
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

// ─── Feedback → GitHub Issue ───
ipcMain.handle('submit-feedback', async (_event: Electron.IpcMainInvokeEvent, data: { title: string; body: string }) => {
  const token = process.env.GH_TOKEN
  if (!token) return { success: false, error: '인증 토큰이 없습니다' }

  try {
    const res = await fetch('https://api.github.com/repos/dinoosaur726/BalloonWall/issues', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: `[피드백] ${data.title}`,
        body: data.body
      })
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[Feedback] Failed:', err)
      return { success: false, error: `전송 실패 (${res.status})` }
    }

    return { success: true }
  } catch (err: any) {
    console.error('[Feedback] Error:', err.message)
    return { success: false, error: err.message }
  }
})
