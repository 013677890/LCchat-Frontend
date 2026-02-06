export const IPC_CHANNELS = {
  session: {
    get: 'session:get',
    set: 'session:set',
    clear: 'session:clear'
  },
  device: {
    getId: 'device:get-id'
  },
  localdb: {
    init: 'localdb:init',
    profile: {
      get: 'localdb:profile:get',
      upsert: 'localdb:profile:upsert'
    },
    friends: {
      getList: 'localdb:friends:get-list',
      replaceAll: 'localdb:friends:replace-all',
      applyChanges: 'localdb:friends:apply-changes'
    },
    applies: {
      getInbox: 'localdb:applies:get-inbox',
      upsertInbox: 'localdb:applies:upsert-inbox'
    },
    blacklist: {
      getList: 'localdb:blacklist:get-list',
      replaceAll: 'localdb:blacklist:replace-all'
    },
    chat: {
      getConversations: 'localdb:chat:get-conversations',
      upsertConversations: 'localdb:chat:upsert-conversations',
      getMessages: 'localdb:chat:get-messages',
      upsertMessages: 'localdb:chat:upsert-messages',
      saveDraft: 'localdb:chat:save-draft',
      getDraft: 'localdb:chat:get-draft'
    }
  }
} as const
