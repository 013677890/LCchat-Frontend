import { clipboard, type IpcMain } from 'electron'
import { IPC_CHANNELS } from './channels'

export function registerClipboardHandlers(ipcMain: IpcMain): void {
  ipcMain.removeHandler(IPC_CHANNELS.clipboard.writeText)
  ipcMain.handle(IPC_CHANNELS.clipboard.writeText, (_, text: unknown) => {
    if (typeof text !== 'string') {
      throw new TypeError('剪贴板内容必须是字符串')
    }
    clipboard.writeText(text)
  })
}
