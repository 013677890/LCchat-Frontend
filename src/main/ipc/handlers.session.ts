import { app, type IpcMain } from 'electron'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { IPC_CHANNELS } from './channels'
import type { SessionData } from '../../shared/types/localdb'

const SESSION_FILE = 'session.json'

let isLoaded = false
let cachedSession: SessionData | null = null

function sessionFilePath(): string {
  return join(app.getPath('userData'), SESSION_FILE)
}

function bind(
  ipcMain: IpcMain,
  channel: string,
  listener: (...args: any[]) => Promise<any> | any
): void {
  ipcMain.removeHandler(channel)
  ipcMain.handle(channel, (_, ...args) => listener(...args))
}

async function loadSessionFromDisk(): Promise<void> {
  if (isLoaded) {
    return
  }

  isLoaded = true

  try {
    const raw = await readFile(sessionFilePath(), 'utf-8')
    cachedSession = JSON.parse(raw) as SessionData
  } catch {
    cachedSession = null
  }
}

async function saveSessionToDisk(payload: SessionData): Promise<void> {
  cachedSession = payload
  // userData 可能指向尚不存在的子目录（如多实例 LCCHAT_INSTANCE），写入前确保目录存在
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(sessionFilePath(), JSON.stringify(payload), 'utf-8')
}

async function clearSessionDiskCache(): Promise<void> {
  cachedSession = null

  try {
    await unlink(sessionFilePath())
  } catch {
    // Ignore "file not exists".
  }
}

export function registerSessionHandlers(ipcMain: IpcMain): void {
  bind(ipcMain, IPC_CHANNELS.session.get, async () => {
    await loadSessionFromDisk()
    return cachedSession
  })

  bind(ipcMain, IPC_CHANNELS.session.set, async (payload: SessionData) => {
    await saveSessionToDisk(payload)
  })

  bind(ipcMain, IPC_CHANNELS.session.clear, async () => {
    await clearSessionDiskCache()
  })
}
