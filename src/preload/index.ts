import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC_CHANNELS } from '../main/ipc/channels'
import type { BridgeApi } from '../shared/types/bridge'
import type {
  BlacklistRow,
  ConversationRow,
  FriendApplyRow,
  FriendChangeRow,
  FriendRow,
  MessageRow,
  ProfileRow,
  SessionData
} from '../shared/types/localdb'

const api: BridgeApi = {
  session: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.session.get),
    set: (payload: SessionData) => ipcRenderer.invoke(IPC_CHANNELS.session.set, payload),
    clear: () => ipcRenderer.invoke(IPC_CHANNELS.session.clear)
  },
  device: {
    getId: () => ipcRenderer.invoke(IPC_CHANNELS.device.getId)
  },
  localdb: {
    init: () => ipcRenderer.invoke(IPC_CHANNELS.localdb.init),
    profile: {
      get: (userUuid: string) => ipcRenderer.invoke(IPC_CHANNELS.localdb.profile.get, userUuid),
      upsert: (profile: ProfileRow) => ipcRenderer.invoke(IPC_CHANNELS.localdb.profile.upsert, profile)
    },
    friends: {
      getList: (userUuid: string) =>
        ipcRenderer.invoke(IPC_CHANNELS.localdb.friends.getList, userUuid),
      replaceAll: (userUuid: string, items: FriendRow[], version: number) =>
        ipcRenderer.invoke(IPC_CHANNELS.localdb.friends.replaceAll, userUuid, items, version),
      applyChanges: (userUuid: string, changes: FriendChangeRow[], latestVersion: number) =>
        ipcRenderer.invoke(
          IPC_CHANNELS.localdb.friends.applyChanges,
          userUuid,
          changes,
          latestVersion
        )
    },
    applies: {
      getInbox: (userUuid: string) =>
        ipcRenderer.invoke(IPC_CHANNELS.localdb.applies.getInbox, userUuid),
      upsertInbox: (userUuid: string, items: FriendApplyRow[]) =>
        ipcRenderer.invoke(IPC_CHANNELS.localdb.applies.upsertInbox, userUuid, items),
      getSent: (userUuid: string) =>
        ipcRenderer.invoke(IPC_CHANNELS.localdb.applies.getSent, userUuid),
      upsertSent: (userUuid: string, items: FriendApplyRow[]) =>
        ipcRenderer.invoke(IPC_CHANNELS.localdb.applies.upsertSent, userUuid, items)
    },
    blacklist: {
      getList: (userUuid: string) => ipcRenderer.invoke(IPC_CHANNELS.localdb.blacklist.getList, userUuid),
      replaceAll: (userUuid: string, items: BlacklistRow[]) =>
        ipcRenderer.invoke(IPC_CHANNELS.localdb.blacklist.replaceAll, userUuid, items)
    },
    chat: {
      getConversations: (userUuid: string) =>
        ipcRenderer.invoke(IPC_CHANNELS.localdb.chat.getConversations, userUuid),
      upsertConversations: (userUuid: string, items: ConversationRow[]) =>
        ipcRenderer.invoke(IPC_CHANNELS.localdb.chat.upsertConversations, userUuid, items),
      getMessages: (userUuid: string, convId: string, cursor?: number, limit?: number) =>
        ipcRenderer.invoke(IPC_CHANNELS.localdb.chat.getMessages, userUuid, convId, cursor, limit),
      upsertMessages: (userUuid: string, convId: string, items: MessageRow[]) =>
        ipcRenderer.invoke(IPC_CHANNELS.localdb.chat.upsertMessages, userUuid, convId, items),
      saveDraft: (userUuid: string, convId: string, draft: string) =>
        ipcRenderer.invoke(IPC_CHANNELS.localdb.chat.saveDraft, userUuid, convId, draft),
      getDraft: (userUuid: string, convId: string) =>
        ipcRenderer.invoke(IPC_CHANNELS.localdb.chat.getDraft, userUuid, convId)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error Legacy fallback for disabled contextIsolation.
  window.electron = electronAPI
  // @ts-expect-error Legacy fallback for disabled contextIsolation.
  window.api = api
}
