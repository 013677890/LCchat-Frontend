import type { IpcMain } from 'electron'
import { registerClipboardHandlers } from './handlers.clipboard'
import { registerDeviceHandlers } from './handlers.device'
import { registerLocalDBHandlers } from './handlers.localdb'
import { registerSessionHandlers } from './handlers.session'

export function registerIpcHandlers(ipcMain: IpcMain): void {
  registerClipboardHandlers(ipcMain)
  registerSessionHandlers(ipcMain)
  registerDeviceHandlers(ipcMain)
  registerLocalDBHandlers(ipcMain)
}
