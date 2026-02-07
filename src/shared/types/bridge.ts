import type {
  BlacklistRow,
  ConversationRow,
  FriendApplyRow,
  FriendChangeRow,
  FriendRow,
  MessageRow,
  ProfileRow,
  SessionData
} from './localdb'

export interface BridgeApi {
  session: {
    get: () => Promise<SessionData | null>
    set: (payload: SessionData) => Promise<void>
    clear: () => Promise<void>
  }
  device: {
    getId: () => Promise<string>
  }
  localdb: {
    init: () => Promise<void>
    profile: {
      get: (userUuid: string) => Promise<ProfileRow | null>
      upsert: (profile: ProfileRow) => Promise<void>
    }
    friends: {
      getList: (userUuid: string) => Promise<FriendRow[]>
      replaceAll: (userUuid: string, items: FriendRow[], version: number) => Promise<void>
      applyChanges: (
        userUuid: string,
        changes: FriendChangeRow[],
        latestVersion: number
      ) => Promise<void>
    }
    applies: {
      getInbox: (userUuid: string) => Promise<FriendApplyRow[]>
      upsertInbox: (userUuid: string, items: FriendApplyRow[]) => Promise<void>
      getSent: (userUuid: string) => Promise<FriendApplyRow[]>
      upsertSent: (userUuid: string, items: FriendApplyRow[]) => Promise<void>
    }
    blacklist: {
      getList: (userUuid: string) => Promise<BlacklistRow[]>
      replaceAll: (userUuid: string, items: BlacklistRow[]) => Promise<void>
    }
    chat: {
      getConversations: (userUuid: string) => Promise<ConversationRow[]>
      upsertConversations: (userUuid: string, items: ConversationRow[]) => Promise<void>
      getMessages: (
        userUuid: string,
        convId: string,
        cursor?: number,
        limit?: number
      ) => Promise<MessageRow[]>
      upsertMessages: (userUuid: string, convId: string, items: MessageRow[]) => Promise<void>
      saveDraft: (userUuid: string, convId: string, draft: string) => Promise<void>
      getDraft: (userUuid: string, convId: string) => Promise<string>
    }
  }
}
