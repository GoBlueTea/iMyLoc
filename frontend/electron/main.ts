import { app, BrowserWindow, session } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, ChildProcess, execSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null
let tunneldProcess: ChildProcess | null = null
let backendProcess: ChildProcess | null = null

function getBackendPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend', 'backend.exe')
  }
  return null
}

function startBackend() {
  const backendExe = getBackendPath()
  if (!backendExe) return

  try {
    tunneldProcess = spawn(backendExe, ['--tunneld'], {
      stdio: 'ignore'
    })
    backendProcess = spawn(backendExe, [], {
      stdio: 'ignore'
    })
  } catch (e) {
    console.error("Failed to start backend: ", e)
  }
}

function stopBackend() {
  try {
    if (tunneldProcess && !tunneldProcess.killed) {
      tunneldProcess.kill('SIGTERM')
    }
    if (backendProcess && !backendProcess.killed) {
      backendProcess.kill('SIGTERM')
    }
  } catch(e) {}
  // Fallback: force-kill by name on Windows
  try {
    execSync('taskkill /F /IM backend.exe /T', { stdio: 'ignore' })
  } catch(_) {}
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    icon: path.join(process.env.VITE_PUBLIC as string, 'iMyLoc-Logo.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  // Completely remove the default menu
  win.setMenu(null)

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(process.env.DIST as string, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('before-quit', () => {
  stopBackend()
})

app.on('will-quit', () => {
  stopBackend()
})

// Final safety net in case Electron crashes
process.on('exit', () => {
  stopBackend()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  // Fix OSM tile 403: inject Referer and User-Agent for tile requests
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://*.tile.openstreetmap.org/*'] },
    (details, callback) => {
      details.requestHeaders['Referer'] = 'https://www.openstreetmap.org/'
      details.requestHeaders['User-Agent'] = 'iMyLoc/1.0.0'
      callback({ requestHeaders: details.requestHeaders })
    }
  )
  startBackend()
  createWindow()
})
