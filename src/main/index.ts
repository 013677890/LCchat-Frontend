import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { closeLocalDB } from './db/sqlite'
import { registerIpcHandlers } from './ipc/register'

// 多实例并行支持（如同时登录两个账号联调）：
// 设置 LCCHAT_INSTANCE=<tag> 后，每个实例使用独立的 userData 目录，
// 彼此的 localStorage 登录态与本地 sqlite 缓存互不干扰。
// Electron 只保证默认 userData 存在，切换后的子目录需要自行创建，
// 否则 device.json / session.json / lcchat.db 的首次写入都会 ENOENT。
const instanceTag = process.env.LCCHAT_INSTANCE
if (instanceTag) {
  const instanceDir = join(app.getPath('userData'), `instance-${instanceTag}`)
  mkdirSync(instanceDir, { recursive: true })
  app.setPath('userData', instanceDir)
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1200,
    minHeight: 760,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.lcchat.desktop')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers(ipcMain)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  closeLocalDB()
})
