import { app, type IpcMain } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { IPC_CHANNELS } from './channels'

const DEVICE_FILE = 'device.json'

let cachedDeviceId = ''

function deviceFilePath(): string {
  return join(app.getPath('userData'), DEVICE_FILE)
}

function bind(
  ipcMain: IpcMain,
  channel: string,
  listener: (...args: any[]) => Promise<any> | any
): void {
  ipcMain.removeHandler(channel)
  ipcMain.handle(channel, (_, ...args) => listener(...args))
}

async function loadOrCreateDeviceId(): Promise<string> {
  if (cachedDeviceId) {
    return cachedDeviceId
  }

  try {
    const raw = await readFile(deviceFilePath(), 'utf-8')
    const parsed = JSON.parse(raw) as { deviceId?: string }
    if (parsed.deviceId) {
      cachedDeviceId = parsed.deviceId
      return cachedDeviceId
    }
  } catch {
    // Ignore read/parse failures and generate a new one.
  }

  cachedDeviceId = randomUUID()
  await writeFile(deviceFilePath(), JSON.stringify({ deviceId: cachedDeviceId }), 'utf-8')
  return cachedDeviceId
}

export function registerDeviceHandlers(ipcMain: IpcMain): void {
  bind(ipcMain, IPC_CHANNELS.device.getId, async () => loadOrCreateDeviceId())
}
