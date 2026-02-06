import type { IpcMain } from 'electron'
import { registerDeviceHandlers } from './handlers.device'
import { registerLocalDBHandlers } from './handlers.localdb'
import { registerSessionHandlers } from './handlers.session'

export function registerIpcHandlers(ipcMain: IpcMain): void {
  registerSessionHandlers(ipcMain)
  registerDeviceHandlers(ipcMain)
  registerLocalDBHandlers(ipcMain)
}
