import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { ConversationRow, JsonObject, MessageRow } from '../../../shared/types/localdb'

function getString(payload: JsonObject, key: string, fallback = ''): string {
  const value = payload[key]
  return typeof value === 'string' ? value : fallback
}

function getNumber(payload: JsonObject, key: string, fallback = 0): number {
  const value = payload[key]
  return typeof value === 'number' ? value : fallback
}

function createSeedConversations(userUuid: string): ConversationRow[] {
  const timestamp = Date.now()
  return [
    {
      userUuid,
      convId: 'conv:product',
      payload: {
        title: '产品群',
        preview: '今晚发布候选版本，记得走 smoke 测试。',
        unread: 2,
        avatarColor: '#6ca06f'
      },
      updatedAt: timestamp - 5 * 60 * 1000
    },
    {
      userUuid,
      convId: 'conv:ops',
      payload: {
        title: '运维值班',
        preview: '网关 CPU 峰值恢复，告警已解除。',
        unread: 0,
        avatarColor: '#7d8da5'
      },
      updatedAt: timestamp - 20 * 60 * 1000
    },
    {
      userUuid,
      convId: 'conv:design',
      payload: {
        title: '设计评审',
        preview: '聊天输入区交互确认通过，进入联调阶段。',
        unread: 0,
        avatarColor: '#9d7f5f'
      },
      updatedAt: timestamp - 40 * 60 * 1000
    }
  ]
}

function createSeedMessages(userUuid: string, convId: string): MessageRow[] {
  const baseTime = Date.now() - 15 * 60 * 1000
  return [
    {
      userUuid,
      convId,
      msgId: `${convId}-seed-1`,
      seq: 1,
      sendTime: baseTime,
      payload: {
        text: '欢迎使用 LCchat，本地缓存已经初始化。',
        from: 'peer'
      },
      status: 1
    },
    {
      userUuid,
      convId,
      msgId: `${convId}-seed-2`,
      seq: 2,
      sendTime: baseTime + 2 * 60 * 1000,
      payload: {
        text: '你现在可以离线查看最近会话和草稿。',
        from: 'self'
      },
      status: 1
    }
  ]
}

export const useSessionStore = defineStore('session', () => {
  const currentUserUuid = ref('')
  const conversations = shallowRef<ConversationRow[]>([])
  const messagesByConversation = shallowRef<Record<string, MessageRow[]>>({})
  const activeConvId = ref('')
  const activeDraft = ref('')
  const loading = ref(false)
  const localDBAvailable = ref(true)

  async function safeRead<T>(runner: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await runner()
    } catch (error) {
      localDBAvailable.value = false
      console.warn('localdb read failed, fallback to memory state', error)
      return fallback
    }
  }

  async function safeWrite(runner: () => Promise<void>): Promise<void> {
    try {
      await runner()
      return
    } catch (error) {
      localDBAvailable.value = false
      console.warn('localdb write failed, fallback to memory state', error)
    }
  }

  const activeConversation = computed(
    () => conversations.value.find((item) => item.convId === activeConvId.value) ?? null
  )

  const activeMessages = computed(() => {
    return messagesByConversation.value[activeConvId.value] ?? []
  })

  async function bootstrap(userUuid: string): Promise<void> {
    if (!userUuid) {
      return
    }

    if (currentUserUuid.value === userUuid && conversations.value.length > 0) {
      return
    }

    loading.value = true
    currentUserUuid.value = userUuid
    await safeWrite(() => window.api.localdb.init())

    let cachedConversations = await safeRead(
      () => window.api.localdb.chat.getConversations(userUuid),
      []
    )
    if (cachedConversations.length === 0) {
      cachedConversations = createSeedConversations(userUuid)
      await safeWrite(() =>
        window.api.localdb.chat.upsertConversations(userUuid, cachedConversations)
      )
    }

    conversations.value = [...cachedConversations].sort((a, b) => b.updatedAt - a.updatedAt)
    activeConvId.value = conversations.value[0]?.convId ?? ''

    if (activeConvId.value) {
      await openConversation(activeConvId.value)
    }

    loading.value = false
  }

  async function openConversation(convId: string): Promise<void> {
    if (!currentUserUuid.value) {
      return
    }

    activeConvId.value = convId
    const userUuid = currentUserUuid.value

    let messages = await safeRead(
      () => window.api.localdb.chat.getMessages(userUuid, convId, undefined, 40),
      []
    )
    if (messages.length === 0) {
      messages = createSeedMessages(userUuid, convId)
      await safeWrite(() => window.api.localdb.chat.upsertMessages(userUuid, convId, messages))
    }

    messagesByConversation.value = {
      ...messagesByConversation.value,
      [convId]: messages
    }

    activeDraft.value = await safeRead(() => window.api.localdb.chat.getDraft(userUuid, convId), '')
  }

  async function setDraft(draft: string): Promise<void> {
    activeDraft.value = draft

    if (!currentUserUuid.value || !activeConvId.value) {
      return
    }

    await safeWrite(() =>
      window.api.localdb.chat.saveDraft(currentUserUuid.value, activeConvId.value, draft)
    )
  }

  async function sendMessage(text: string): Promise<void> {
    const normalizedText = text.trim()
    if (!normalizedText || !currentUserUuid.value || !activeConvId.value) {
      return
    }

    const userUuid = currentUserUuid.value
    const convId = activeConvId.value
    const timestamp = Date.now()
    const nextMessage: MessageRow = {
      userUuid,
      convId,
      msgId: crypto.randomUUID(),
      sendTime: timestamp,
      payload: {
        text: normalizedText,
        from: 'self'
      },
      status: 1
    }

    await safeWrite(() => window.api.localdb.chat.upsertMessages(userUuid, convId, [nextMessage]))

    const nextMessages = [...(messagesByConversation.value[convId] ?? []), nextMessage]
    messagesByConversation.value = {
      ...messagesByConversation.value,
      [convId]: nextMessages
    }

    const nextConversations = conversations.value.map((item) => {
      if (item.convId !== convId) {
        return item
      }

      return {
        ...item,
        payload: {
          ...item.payload,
          preview: normalizedText
        },
        updatedAt: timestamp
      }
    })

    const sortedConversations = [...nextConversations].sort((a, b) => b.updatedAt - a.updatedAt)
    conversations.value = sortedConversations
    await safeWrite(() =>
      window.api.localdb.chat.upsertConversations(userUuid, sortedConversations)
    )
    await setDraft('')
  }

  function getConversationTitle(row: ConversationRow): string {
    return getString(row.payload, 'title', row.convId)
  }

  function getConversationPreview(row: ConversationRow): string {
    return getString(row.payload, 'preview')
  }

  function getConversationUnread(row: ConversationRow): number {
    return getNumber(row.payload, 'unread')
  }

  async function clearState(): Promise<void> {
    currentUserUuid.value = ''
    conversations.value = []
    messagesByConversation.value = {}
    activeConvId.value = ''
    activeDraft.value = ''
    loading.value = false
    localDBAvailable.value = true
  }

  return {
    currentUserUuid,
    conversations,
    activeConvId,
    activeDraft,
    activeConversation,
    activeMessages,
    loading,
    localDBAvailable,
    bootstrap,
    openConversation,
    setDraft,
    sendMessage,
    getConversationTitle,
    getConversationPreview,
    getConversationUnread,
    clearState
  }
})
