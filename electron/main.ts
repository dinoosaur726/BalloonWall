import { fileURLToPath } from 'node:url'
import path from 'node:path'
import http from 'node:http'
import fs from 'node:fs'
import { WebSocketServer, WebSocket } from 'ws'
import Store from 'electron-store'
import { autoUpdater } from 'electron-updater'
const electron = require('electron')
const { app, ipcMain, BrowserWindow, shell } = electron

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
  useForChallenge?: boolean
  useForBattle?: boolean
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
  autoAddChallenge?: boolean
  minAmountChallenge?: number
  autoAddBattle?: boolean
  minAmountBattle?: number
  useSignatureForMissions?: boolean
  snapToStacks?: boolean
  newCardPosition?: string
  design?: { showNickname: boolean, showAmount: boolean }
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
    autoAddChallenge: true,
    minAmountChallenge: 0,
    autoAddBattle: true,
    minAmountBattle: 0,
    useSignatureForMissions: false,
    snapToStacks: true,
    newCardPosition: 'middle-left',
    design: { showNickname: true, showAmount: true },
    lastSeenPatchNotes: ''
  }
})

const isValidPort = (p: unknown): p is number =>
  typeof p === 'number' && Number.isInteger(p) && p >= 1 && p <= 65535

// 창이 닫힌 뒤 파괴된 webContents에 send하면 메인 프로세스가 죽는다 — 항상 이 헬퍼를 통해 보낸다
function sendToRenderer(channel: string, payload?: unknown) {
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, payload)
  }
}

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
  // close()는 비동기라 같은 포트로 즉시 재listen하면 EADDRINUSE로 서버가 죽는다
  if (httpServer) {
    const old = httpServer
    httpServer = null
    old.closeAllConnections?.()
    old.close(() => doStartHttpServer(port))
    return
  }
  doStartHttpServer(port)
}

function doStartHttpServer(port: number) {
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

    const rel = path.relative(serveDir, filePath)
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
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
  // close()는 비동기라 같은 포트로 즉시 재생성하면 EADDRINUSE가 난다
  if (wss) {
    const old = wss
    wss = null
    old.clients.forEach((client) => client.terminate())
    old.close(() => doStartWebSocketServer(port))
    return
  }
  doStartWebSocketServer(port)
}

function doStartWebSocketServer(port: number) {
  try {
    wss = new WebSocketServer({ port })
  } catch (error) {
    console.error('Failed to start WebSocket server:', error)
    return
  }
  console.log(`WebSocket server started on port ${port}`)

  // 포트 사용 중 등의 에러는 비동기 'error' 이벤트로 온다 — 리스너가 없으면 앱 전체가 크래시한다
  wss.on('error', (err) => {
    console.error('[Main] WebSocket server error:', err)
  })

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

      // 형식: Type/Nickname/Amount 또는 Nickname/Amount
      // 닉네임에 '/'가 포함될 수 있으므로 첫 조각(타입)과 마지막 조각(개수)만 떼고 가운데를 닉네임으로 합친다
      if (msgStr.includes('/')) {
        const parts = msgStr.split('/')
        if (parts.length < 2) return
        const amount = parseInt(parts[parts.length - 1], 10)
        if (isNaN(amount)) return

        let type: 'Normal' | 'Ad' | 'Challenge' | 'Battle' = 'Normal'
        let nickname: string
        if (parts.length === 2) {
          nickname = parts[0]
        } else {
          const typeStr = parts[0]
          type = typeStr === 'Ad' ? 'Ad'
            : typeStr === 'Challenge' ? 'Challenge'
            : typeStr === 'Battle' ? 'Battle'
            : 'Normal'
          nickname = parts.slice(1, -1).join('/')
        }
        sendToRenderer('new-donation', { type, nickname, amount })
      }
    })
  })
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

  win.on('closed', () => {
    win = null
  })

  win.webContents.on('did-finish-load', () => {
    sendToRenderer('main-process-message', (new Date).toLocaleString())
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
  const sanitized = { ...newSettings }
  // NaN/범위 밖 포트가 저장되면 다음 실행에서 서버가 아예 뜨지 않는다
  if ('wsPort' in sanitized && !isValidPort(sanitized.wsPort)) delete sanitized.wsPort
  if ('httpPort' in sanitized && !isValidPort(sanitized.httpPort)) delete sanitized.httpPort

  const prevWsPort = store.get('wsPort')
  const prevHttpPort = store.get('httpPort')

  for (const [key, value] of Object.entries(sanitized)) {
    // @ts-ignore
    store.set(key, value)
  }

  // 포트가 실제로 바뀐 경우에만 재시작한다 — 설정 저장 때마다 재시작하면 OBS 연결이 매번 끊긴다
  if (isValidPort(sanitized.wsPort) && sanitized.wsPort !== prevWsPort) {
    startWebSocketServer(sanitized.wsPort)
  }

  if (isValidPort(sanitized.httpPort) && sanitized.httpPort !== prevHttpPort) {
    startHttpServer(sanitized.httpPort)
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
  // 구버전 버그로 null/NaN이 저장되어 있을 수 있으므로 기본 포트로 복구한다
  const wsPort = isValidPort(store.get('wsPort')) ? store.get('wsPort') : 3005
  const httpPort = isValidPort(store.get('httpPort')) ? store.get('httpPort') : 3006
  store.set('wsPort', wsPort)
  store.set('httpPort', httpPort)
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
      sendToRenderer('update-available', {
        version: info.version,
        releaseNotes: info.releaseNotes
      })
    })

    autoUpdater.on('update-not-available', () => {
      console.log('[AutoUpdater] Already up to date')
      sendToRenderer('update-not-available')
    })

    autoUpdater.on('download-progress', (progress: any) => {
      sendToRenderer('update-progress', {
        percent: Math.round(progress.percent)
      })
    })

    autoUpdater.on('update-downloaded', () => {
      console.log('[AutoUpdater] Update downloaded, ready to install')
      sendToRenderer('update-downloaded')
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
