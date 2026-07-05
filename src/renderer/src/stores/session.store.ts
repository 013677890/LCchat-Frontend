import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { toast } from 'vue-sonner'
import type { ConversationRow, JsonObject, MessageRow } from '../../../shared/types/localdb'
import { httpClient } from '../shared/http/client'
import { useFriendStore } from './friend.store'
import { useGroupStore } from './group.store'
import { useAppStore } from './app.store'

const MAX_CONVERSATION_SYNC_ROUNDS = 20
const MAX_MESSAGE_PULL_ROUNDS = 20
const MESSAGE_PAGE_SIZE = 40
const DRAFT_SAVE_DEBOUNCE_MS = 300

interface PullMessagesData {
  messages?: any[]
  hasMore?: boolean
  maxSeq?: number
}

interface ConversationsData {
  conversations?: any[]
  hasMore?: boolean
  nextCursor?: string
}

async function pullMessageRows(
  userUuid: string,
  convId: string,
  options: {
    anchorSeq: number
    direction: 1 | 2
    followHasMore: boolean
    limit?: number
  }
): Promise<MessageRow[]> {
  const pulledRows: MessageRow[] = []
  let anchorSeq = options.anchorSeq
  let hasMore = true
  let rounds = 0

  while (hasMore && rounds < MAX_MESSAGE_PULL_ROUNDS) {
    rounds += 1

    const response = await httpClient.get('/api/v1/auth/messages/pull', {
      params: {
        convId,
        anchorSeq,
        limit: options.limit ?? 100,
        direction: options.direction
      }
    })
    const data = (response.data.data ?? {}) as PullMessagesData
    const mapped = (data.messages ?? []).map((item: any) => mapMsgItemToRow(userUuid, item))
    pulledRows.push(...mapped)

    if (mapped.length === 0 || !options.followHasMore) {
      break
    }

    const nextAnchorSeq = Math.max(...mapped.map((item) => item.seq ?? anchorSeq))
    if (nextAnchorSeq <= anchorSeq) {
      break
    }

    anchorSeq = nextAnchorSeq
    hasMore = Boolean(data.hasMore)
  }

  return pulledRows
}

function getMaxMessageSeq(rows: MessageRow[]): number {
  return rows.reduce((maxSeq, item) => Math.max(maxSeq, item.seq ?? 0), 0)
}

function getMinPositiveMessageSeq(rows: MessageRow[]): number {
  return rows.reduce((minSeq, item) => {
    const seq = item.seq ?? 0
    if (!Number.isFinite(seq) || seq <= 0) {
      return minSeq
    }
    return Math.min(minSeq, seq)
  }, Number.POSITIVE_INFINITY)
}

function resolveAckSeq(previousMaxSeq: number, rows: MessageRow[], receivedSeq?: number): number {
  const targetSeq = Number(receivedSeq ?? 0)
  if (!Number.isFinite(targetSeq) || targetSeq <= 0) {
    return 0
  }

  const seqSet = new Set(
    rows.map((item) => item.seq ?? 0).filter((seq) => Number.isFinite(seq) && seq > 0)
  )
  let ackSeq = Math.max(0, Math.min(previousMaxSeq, targetSeq))

  if (ackSeq === 0 && seqSet.has(1)) {
    ackSeq = 1
  }

  for (let seq = ackSeq + 1; seq <= targetSeq; seq += 1) {
    if (!seqSet.has(seq)) {
      break
    }
    ackSeq = seq
  }

  return ackSeq
}

function getString(payload: JsonObject, key: string, fallback = ''): string {
  const value = payload[key]
  return typeof value === 'string' ? value : fallback
}

function getNumber(payload: JsonObject, key: string, fallback = 0): number {
  const value = payload[key]
  return typeof value === 'number' ? value : fallback
}

function mapMsgItemToRow(userUuid: string, item: any): MessageRow {
  let text = ""
  try {
    const contentObj = typeof item.content === 'string' ? JSON.parse(item.content) : item.content
    text = contentObj.text || contentObj.preview || ""
  } catch (e) {
    text = item.content || ""
  }

  if (item.status === 1) {
    try {
      const contentObj = typeof item.content === 'string' ? JSON.parse(item.content) : item.content
      text = contentObj.text || "撤回了一条消息"
    } catch (e) {
      text = "撤回了一条消息"
    }
  }

  return {
    userUuid,
    convId: item.convId,
    msgId: item.msgId,
    clientMsgId: item.clientMsgId,
    seq: Number(item.seq),
    sendTime: Number(item.sendTime),
    status: item.status,
    payload: {
      text: text,
      from: item.fromUuid === userUuid ? 'self' : 'peer',
      fromUuid: item.fromUuid,
      originalContent: item.content
    }
  }
}

function mapConversationItemToRow(userUuid: string, item: any): ConversationRow {
  let previewText = ""
  if (item.lastMsg) {
    try {
      const parsed = JSON.parse(item.lastMsg.previewJson || '{}')
      previewText = parsed.preview || parsed.text || ""
    } catch (e) {
      previewText = item.lastMsg.previewJson || ""
    }
  }

  return {
    userUuid,
    convId: item.convId,
    payload: {
      title: item.convType === 2 ? `群聊` : `单聊`,
      preview: previewText,
      unread: item.unreadCount || 0,
      mute: item.mute || false,
      pin: item.pin || false,
      convType: item.convType,
      targetUuid: item.targetUuid,
      avatarColor: item.convType === 2 ? '#6ca06f' : '#7d8da5'
    },
    updatedAt: Number(item.updatedAt)
  }
}

function sortConversations(list: ConversationRow[]): ConversationRow[] {
  return [...list].sort((a, b) => {
    const aPin = a.payload.pin === true ? 1 : 0
    const bPin = b.payload.pin === true ? 1 : 0
    if (aPin !== bPin) {
      return bPin - aPin
    }
    return b.updatedAt - a.updatedAt
  })
}

function upsertMessages(currentRows: MessageRow[], nextRows: MessageRow[]): MessageRow[] {
  const merged = [...currentRows]

  for (const nextRow of nextRows) {
    const existingIndex = merged.findIndex((row) => {
      if (row.msgId === nextRow.msgId) {
        return true
      }
      return Boolean(row.clientMsgId && row.clientMsgId === nextRow.clientMsgId)
    })

    if (existingIndex >= 0) {
      merged[existingIndex] = nextRow
    } else {
      merged.push(nextRow)
    }
  }

  return merged.sort((a, b) => a.sendTime - b.sendTime)
}

export function buildP2PConversationId(userUuid: string, targetUuid: string): string {
  const sorted = [userUuid, targetUuid].sort()
  return `p2p-${sorted.join('-')}`
}

export const useSessionStore = defineStore('session', () => {
  const currentUserUuid = ref('')
  const conversations = shallowRef<ConversationRow[]>([])
  const messagesByConversation = shallowRef<Record<string, MessageRow[]>>({})
  const activeConvId = ref('')
  const activeDraft = ref('')
  const loading = ref(false)
  const loadingOlderMessages = ref(false)
  const localDBAvailable = ref(true)
  const olderHistoryExhaustedByConversation = shallowRef<Record<string, boolean>>({})
  // 对端已读位点（convId → 对方已读到的最大 seq），来源于 MSG_READ_RECEIPT 推送。
  // 仅内存态：离线期间的回执由下次已读推送覆盖，不参与本地持久化。
  const peerReadSeqByConversation = shallowRef<Record<string, number>>({})

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

  const activeHasMoreBefore = computed(() => {
    if (!activeConvId.value) return false
    return olderHistoryExhaustedByConversation.value[activeConvId.value] !== true
  })

  function dropConversationRuntimeState(convId: string): void {
    if (!convId) {
      return
    }

    if (messagesByConversation.value[convId]) {
      const nextMessages = { ...messagesByConversation.value }
      delete nextMessages[convId]
      messagesByConversation.value = nextMessages
    }

    if (olderHistoryExhaustedByConversation.value[convId] !== undefined) {
      const nextExhausted = { ...olderHistoryExhaustedByConversation.value }
      delete nextExhausted[convId]
      olderHistoryExhaustedByConversation.value = nextExhausted
    }
  }

  function setOlderHistoryExhausted(convId: string, exhausted: boolean): void {
    if (!convId) return
    olderHistoryExhaustedByConversation.value = {
      ...olderHistoryExhaustedByConversation.value,
      [convId]: exhausted
    }
  }

  async function activateFallbackConversation(removedConvId: string): Promise<void> {
    if (!removedConvId || activeConvId.value !== removedConvId) {
      return
    }

    const nextConvId = conversations.value[0]?.convId ?? ''
    activeConvId.value = nextConvId
    activeDraft.value = ''

    if (nextConvId) {
      await openConversation(nextConvId)
    }
  }

  async function bootstrap(userUuid: string): Promise<void> {
    if (!userUuid) return

    if (currentUserUuid.value === userUuid && conversations.value.length > 0) {
      return
    }

    loading.value = true
    currentUserUuid.value = userUuid
    await safeWrite(() => window.api.localdb.init())

    // 1. Load from local SQLite cache
    const cachedConversations = await safeRead(
      () => window.api.localdb.chat.getConversations(userUuid),
      []
    )
    conversations.value = sortConversations(cachedConversations)

    // 2. Resync from server
    await syncConversationsFromServer(userUuid)

    if (conversations.value.length > 0) {
      activeConvId.value = conversations.value[0]?.convId ?? ''
      if (activeConvId.value) {
        await openConversation(activeConvId.value)
      }
    }

    loading.value = false
  }

  async function syncConversationsFromServer(userUuid: string): Promise<void> {
    try {
      const items: any[] = []
      let cursor = ''
      let hasMore = true
      let rounds = 0
      const seenCursors = new Set<string>()

      while (hasMore && rounds < MAX_CONVERSATION_SYNC_ROUNDS) {
        rounds += 1

        const response = await httpClient.get('/api/v1/auth/conversations', {
          params: {
            pageSize: 100,
            ...(cursor ? { cursor } : {})
          }
        })
        const data = (response.data.data ?? {}) as ConversationsData
        items.push(...(data.conversations ?? []))

        const nextCursor = data.nextCursor ?? ''
        hasMore = Boolean(data.hasMore)
        if (!hasMore || !nextCursor || seenCursors.has(nextCursor)) {
          break
        }

        seenCursors.add(nextCursor)
        cursor = nextCursor
      }
      
      const mapped = items.map((item: any) => mapConversationItemToRow(userUuid, item))
      const removedActiveConvId =
        activeConvId.value && !mapped.some((item) => item.convId === activeConvId.value)
          ? activeConvId.value
          : ''
      await safeWrite(() => window.api.localdb.chat.replaceConversations(userUuid, mapped))
      
      conversations.value = sortConversations(mapped)
      if (removedActiveConvId) {
        dropConversationRuntimeState(removedActiveConvId)
        await activateFallbackConversation(removedActiveConvId)
      }
    } catch (error) {
      console.error('Failed to sync conversations from server:', error)
    }
  }

  async function openConversation(convId: string): Promise<void> {
    if (!currentUserUuid.value) return

    activeConvId.value = convId
    const userUuid = currentUserUuid.value

    // Load from local SQLite
    let messages = await safeRead(
      () => window.api.localdb.chat.getMessages(userUuid, convId, undefined, MESSAGE_PAGE_SIZE),
      []
    )

    // Pull from backend
    try {
      const hasCachedMessages = messages.length > 0
      const pullDirection = hasCachedMessages ? 1 : 2
      const anchorSeq = hasCachedMessages ? getMaxMessageSeq(messages) : 0
      const pulledRows = await pullMessageRows(userUuid, convId, {
        anchorSeq,
        direction: pullDirection,
        followHasMore: pullDirection === 1,
        limit: 100
      })
      
      if (pulledRows.length > 0) {
        await safeWrite(() => window.api.localdb.chat.upsertMessages(userUuid, convId, pulledRows))
        messages = upsertMessages(messages, pulledRows)
      }
    } catch (error) {
      console.warn('Failed to pull messages from server, using cache', error)
    }

    messagesByConversation.value = {
      ...messagesByConversation.value,
      [convId]: messages.sort((a, b) => a.sendTime - b.sendTime)
    }
    const minSeq = getMinPositiveMessageSeq(messages)
    setOlderHistoryExhausted(convId, messages.length === 0 || minSeq <= 1)

    activeDraft.value = await safeRead(() => window.api.localdb.chat.getDraft(userUuid, convId), '')
    
    // Mark as read
    if (messages.length > 0) {
      const maxSeq = Math.max(...messages.map(m => m.seq || 0))
      if (maxSeq > 0) {
        await markRead(convId, maxSeq)
      }
    }
  }

  let draftSaveTimer: ReturnType<typeof setTimeout> | null = null

  async function persistDraft(userUuid: string, convId: string, draft: string): Promise<void> {
    await safeWrite(() => window.api.localdb.chat.saveDraft(userUuid, convId, draft))
  }

  async function setDraft(
    draft: string,
    options: { immediate?: boolean } = {}
  ): Promise<void> {
    activeDraft.value = draft
    if (!currentUserUuid.value || !activeConvId.value) return

    const userUuid = currentUserUuid.value
    const convId = activeConvId.value

    if (draftSaveTimer) {
      clearTimeout(draftSaveTimer)
      draftSaveTimer = null
    }

    if (options.immediate) {
      await persistDraft(userUuid, convId, draft)
      return
    }

    draftSaveTimer = setTimeout(() => {
      draftSaveTimer = null
      void persistDraft(userUuid, convId, draft)
    }, DRAFT_SAVE_DEBOUNCE_MS)
  }

  async function loadOlderMessages(): Promise<void> {
    const userUuid = currentUserUuid.value
    const convId = activeConvId.value
    if (!userUuid || !convId || loadingOlderMessages.value || !activeHasMoreBefore.value) {
      return
    }

    const currentMessages = messagesByConversation.value[convId] ?? []
    if (currentMessages.length === 0) {
      setOlderHistoryExhausted(convId, true)
      return
    }

    loadingOlderMessages.value = true
    try {
      const oldestSendTime = currentMessages[0]?.sendTime
      const localRows =
        typeof oldestSendTime === 'number'
          ? await safeRead(
              () => window.api.localdb.chat.getMessages(userUuid, convId, oldestSendTime, MESSAGE_PAGE_SIZE),
              []
            )
          : []

      let rowsToMerge = localRows
      const minSeq = getMinPositiveMessageSeq(currentMessages)

      if (rowsToMerge.length < MESSAGE_PAGE_SIZE && Number.isFinite(minSeq) && minSeq > 1) {
        try {
          const pulledRows = await pullMessageRows(userUuid, convId, {
            anchorSeq: minSeq,
            direction: 2,
            followHasMore: false,
            limit: MESSAGE_PAGE_SIZE
          })

          if (pulledRows.length > 0) {
            await safeWrite(() => window.api.localdb.chat.upsertMessages(userUuid, convId, pulledRows))
            rowsToMerge = upsertMessages(rowsToMerge, pulledRows)
          }
        } catch (error) {
          console.warn('Failed to pull older messages from server, using local cache only', error)
        }
      }

      if (rowsToMerge.length > 0) {
        const merged = upsertMessages(currentMessages, rowsToMerge)
        messagesByConversation.value = {
          ...messagesByConversation.value,
          [convId]: merged
        }

        const nextMinSeq = getMinPositiveMessageSeq(merged)
        setOlderHistoryExhausted(convId, !Number.isFinite(nextMinSeq) || nextMinSeq <= 1)
      } else {
        setOlderHistoryExhausted(convId, true)
      }
    } finally {
      loadingOlderMessages.value = false
    }
  }

  async function markRead(convId: string, readSeq: number) {
    if (!currentUserUuid.value) return
    try {
      const response = await httpClient.post('/api/v1/auth/conversations/mark-read', {
        convId,
        readSeq
      })
      const unreadCount = Number(response.data.data?.unreadCount ?? 0)
      
      conversations.value = conversations.value.map(c => {
        if (c.convId === convId) {
          return {
            ...c,
            payload: {
              ...c.payload,
              unread: unreadCount
            }
          }
        }
        return c
      })
    } catch (error) {
      console.error('Failed to mark read:', error)
    }
  }

  async function sendMessage(text: string): Promise<void> {
    const normalizedText = text.trim()
    if (!normalizedText || !currentUserUuid.value || !activeConvId.value) return

    const userUuid = currentUserUuid.value
    const convId = activeConvId.value
    const activeConv = activeConversation.value
    if (!activeConv) return

    const clientMsgId = crypto.randomUUID()
    const timestamp = Date.now()
    
    // Optimistic insert
    const tempMessage: MessageRow = {
      userUuid,
      convId,
      msgId: clientMsgId,
      clientMsgId,
      sendTime: timestamp,
      payload: {
        text: normalizedText,
        from: 'self',
        fromUuid: userUuid
      },
      status: 0
    }

    const currentMessages = messagesByConversation.value[convId] ?? []
    messagesByConversation.value = {
      ...messagesByConversation.value,
      [convId]: [...currentMessages, tempMessage]
    }

    updateConversationPreview(convId, normalizedText, timestamp)
    await setDraft('', { immediate: true })

    try {
      const response = await httpClient.post('/api/v1/auth/messages/send', {
        clientMsgId,
        convType: activeConv.payload.convType,
        targetUuid: activeConv.payload.targetUuid,
        msgType: 1,
        content: JSON.stringify({ text: normalizedText })
      })

      const respData = response.data.data
      const confirmedMessage: MessageRow = {
        userUuid,
        convId,
        msgId: respData.msgId,
        clientMsgId,
        seq: Number(respData.seq),
        sendTime: Number(respData.sendTime),
        status: 0,
        payload: {
          text: normalizedText,
          from: 'self',
          fromUuid: userUuid
        }
      }

      await safeWrite(() => window.api.localdb.chat.upsertMessages(userUuid, convId, [confirmedMessage]))

      const currentMessages = messagesByConversation.value[convId] ?? []
      messagesByConversation.value = {
        ...messagesByConversation.value,
        [convId]: upsertMessages(currentMessages, [confirmedMessage])
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      
      const failedMessage: MessageRow = {
        ...tempMessage,
        status: -1
      }
      
      await safeWrite(() => window.api.localdb.chat.upsertMessages(userUuid, convId, [failedMessage]))
      
      const list = messagesByConversation.value[convId] ?? []
      messagesByConversation.value = {
        ...messagesByConversation.value,
        [convId]: list.map(m => m.clientMsgId === clientMsgId ? failedMessage : m)
      }
    }
  }

  async function resendMessage(clientMsgId: string): Promise<void> {
    if (!currentUserUuid.value || !activeConvId.value) return

    const userUuid = currentUserUuid.value
    const convId = activeConvId.value
    const activeConv = activeConversation.value
    if (!activeConv) return

    const list = messagesByConversation.value[convId] ?? []
    const failedMsg = list.find(m => m.clientMsgId === clientMsgId)
    if (!failedMsg) return

    // 1. Update status to 0 (retrying/sending)
    const retryingMsg: MessageRow = {
      ...failedMsg,
      status: 0,
      sendTime: Date.now()
    }

    messagesByConversation.value = {
      ...messagesByConversation.value,
      [convId]: list.map(m => m.clientMsgId === clientMsgId ? retryingMsg : m)
    }

    const text = typeof retryingMsg.payload.text === 'string' ? retryingMsg.payload.text : ''

    try {
      const response = await httpClient.post('/api/v1/auth/messages/send', {
        clientMsgId,
        convType: activeConv.payload.convType,
        targetUuid: activeConv.payload.targetUuid,
        msgType: 1,
        content: JSON.stringify({ text })
      })

      const respData = response.data.data
      const confirmedMessage: MessageRow = {
        userUuid,
        convId,
        msgId: respData.msgId,
        clientMsgId,
        seq: Number(respData.seq),
        sendTime: Number(respData.sendTime),
        status: 0,
        payload: {
          text,
          from: 'self',
          fromUuid: userUuid
        }
      }

      await safeWrite(() => window.api.localdb.chat.upsertMessages(userUuid, convId, [confirmedMessage]))

      const currentMessages = messagesByConversation.value[convId] ?? []
      messagesByConversation.value = {
        ...messagesByConversation.value,
        [convId]: upsertMessages(currentMessages, [confirmedMessage])
      }
      toast.success('消息已重新发送')
    } catch (error) {
      console.error('Failed to resend message:', error)
      const failedMessage: MessageRow = {
        ...retryingMsg,
        status: -1
      }
      await safeWrite(() => window.api.localdb.chat.upsertMessages(userUuid, convId, [failedMessage]))
      
      const currentList = messagesByConversation.value[convId] ?? []
      messagesByConversation.value = {
        ...messagesByConversation.value,
        [convId]: currentList.map(m => m.clientMsgId === clientMsgId ? failedMessage : m)
      }
      toast.error('重发失败，请检查网络连接')
    }
  }

  async function recallMessage(msgId: string): Promise<void> {
    if (!currentUserUuid.value || !activeConvId.value) return

    try {
      await httpClient.post('/api/v1/auth/messages/recall', {
        convId: activeConvId.value,
        msgId
      })

      const userUuid = currentUserUuid.value
      const convId = activeConvId.value
      const currentMessages = messagesByConversation.value[convId] ?? []

      let recalledMessage: MessageRow | null = null
      const nextMessages = currentMessages.map(m => {
        if (m.msgId === msgId) {
          recalledMessage = {
            ...m,
            status: 1,
            payload: {
              ...m.payload,
              text: '消息已撤回'
            }
          }
          return recalledMessage
        }
        return m
      })

      if (!recalledMessage) {
        return
      }
      const persistedMessage: MessageRow = recalledMessage

      messagesByConversation.value = {
        ...messagesByConversation.value,
        [convId]: nextMessages
      }

      await safeWrite(() => window.api.localdb.chat.upsertMessages(userUuid, convId, [persistedMessage]))
    } catch (error) {
      console.error('Failed to recall message:', error)
    }
  }

  async function deleteConv(convId: string): Promise<void> {
    if (!currentUserUuid.value) return
    try {
      const userUuid = currentUserUuid.value
      await httpClient.delete(`/api/v1/auth/conversations/${encodeURIComponent(convId)}`)
      conversations.value = conversations.value.filter(c => c.convId !== convId)
      await safeWrite(() => window.api.localdb.chat.replaceConversations(userUuid, conversations.value))
      dropConversationRuntimeState(convId)
      await activateFallbackConversation(convId)
    } catch (e) {
      console.error(e)
    }
  }

  async function updateConvSettings(convId: string, settings: { mute?: boolean; pin?: boolean }) {
    if (!currentUserUuid.value) return
    try {
      await httpClient.patch('/api/v1/auth/conversations/settings', {
        convId,
        ...settings
      })
      conversations.value = conversations.value.map(c => {
        if (c.convId === convId) {
          return {
            ...c,
            payload: {
              ...c.payload,
              mute: settings.mute !== undefined ? settings.mute : (c.payload.mute ?? false),
              pin: settings.pin !== undefined ? settings.pin : (c.payload.pin ?? false)
            }
          } as ConversationRow
        }
        return c
      })
      conversations.value = sortConversations(conversations.value)
    } catch (e) {
      console.error(e)
    }
  }

  function playNotificationSound(): void {
    const appStore = useAppStore()
    if (!appStore.soundEnabled) return

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextClass) return
      const ctx = new AudioContextClass()
      
      const now = ctx.currentTime
      
      // First tone (higher pitch)
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(880, now) // A5
      osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.15)
      
      gain1.gain.setValueAtTime(0.15, now)
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
      
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      
      // Second tone (lower harmony, slightly delayed)
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(659.25, now + 0.05) // E5
      osc2.frequency.exponentialRampToValueAtTime(880, now + 0.2)
      
      gain2.gain.setValueAtTime(0.1, now + 0.05)
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45)
      
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      
      osc1.start(now)
      osc1.stop(now + 0.4)
      
      osc2.start(now + 0.05)
      osc2.stop(now + 0.45)
    } catch (e) {
      console.warn('Failed to play notification sound', e)
    }
  }

  // WS Handlers
  async function handleIncomingMessage(userUuid: string, item: any): Promise<number> {
    const convId = item.convId
    const mapped = mapMsgItemToRow(userUuid, item)
    const currentList = messagesByConversation.value[convId] ?? []
    const knownMessages =
      currentList.length > 0
        ? currentList
        : await safeRead(
            () => window.api.localdb.chat.getMessages(userUuid, convId, undefined, 100),
            []
          )
    const previousMaxSeq = getMaxMessageSeq(knownMessages)
    let pulledRows: MessageRow[] = []

    if ((mapped.seq ?? 0) > previousMaxSeq + 1) {
      try {
        pulledRows = await pullMessageRows(userUuid, convId, {
          anchorSeq: previousMaxSeq,
          direction: 1,
          followHasMore: true
        })
      } catch (error) {
        console.warn('Failed to pull message gap from server, keeping pushed message only', error)
      }
    }

    const rowsToPersist = upsertMessages(pulledRows, [mapped])
    const mergedMessages = upsertMessages(knownMessages, rowsToPersist)

    await safeWrite(() => window.api.localdb.chat.upsertMessages(userUuid, convId, rowsToPersist))

    if (!conversations.value.some((conversation) => conversation.convId === convId)) {
      await syncConversationsFromServer(userUuid)
    }

    if (activeConvId.value === convId) {
      messagesByConversation.value = {
        ...messagesByConversation.value,
        [convId]: mergedMessages
      }

      if (mapped.seq) {
        await markRead(convId, mapped.seq)
      }
    } else if (messagesByConversation.value[convId]) {
      messagesByConversation.value = {
        ...messagesByConversation.value,
        [convId]: mergedMessages
      }
    } else {
      conversations.value = conversations.value.map(c => {
        if (c.convId === convId) {
          return {
            ...c,
            payload: {
              ...c.payload,
              unread: Number(c.payload.unread || 0) + 1
            }
          }
        }
        return c
      })
    }

    updateConversationPreview(convId, mapped.payload.text as string, mapped.sendTime)

    // Play notification sound and show toast for incoming messages from others
    if (item.fromUuid !== userUuid) {
      playNotificationSound()

      // Show toast if we are not actively viewing this conversation OR if the window is blurred
      if (activeConvId.value !== convId || !document.hasFocus()) {
          const appStore = useAppStore()
          if (appStore.toastEnabled) {
            const friendStore = useFriendStore()
            const groupStore = useGroupStore()

            let senderName = '未知用户'
          const friend = friendStore.friends.find(f => f.peerUuid === item.fromUuid)
          if (friend) {
            senderName = (friend.payload.remark as string) || (friend.payload.nickname as string) || item.fromUuid
          } else {
            const member = groupStore.activeMembers.find(m => m.userUuid === item.fromUuid)
            if (member) {
              senderName = member.nickname || item.fromUuid
            }
          }

          const conv = conversations.value.find(c => c.convId === convId)
          const isGroup = conv?.payload.convType === 2
          const preview = mapped.payload.text || '发送了一条消息'

          if (isGroup) {
            const groupName = conv?.payload.title || '群组'
            toast.info(`${groupName} | ${senderName}: ${preview}`, {
              duration: 4500,
              action: {
                label: '查看',
                onClick: () => {
                  appStore.setActiveNav('chat')
                  openConversation(convId)
                }
              }
            })
          } else {
            toast.info(`${senderName}: ${preview}`, {
              duration: 4500,
              action: {
                label: '查看',
                onClick: () => {
                  appStore.setActiveNav('chat')
                  openConversation(convId)
                }
              }
            })
          }
        }
      }
    }

    return resolveAckSeq(previousMaxSeq, mergedMessages, mapped.seq)
  }

  async function handleIncomingRecall(userUuid: string, notice: any): Promise<void> {
    const convId = notice.convId
    const msgId = notice.msgId

    let messages = messagesByConversation.value[convId] ?? []
    if (messages.length === 0) {
      messages = await safeRead(() => window.api.localdb.chat.getMessages(userUuid, convId, undefined, 100), [])
    }

    const target = messages.find(m => m.msgId === msgId)
    if (!target) {
      return
    }

    const recalledMessage: MessageRow = {
      ...target,
      status: 1,
      payload: {
        ...target.payload,
        text: '消息已撤回'
      }
    }

    await safeWrite(() => window.api.localdb.chat.upsertMessages(userUuid, convId, [recalledMessage]))

    if (messagesByConversation.value[convId]) {
      messagesByConversation.value = {
        ...messagesByConversation.value,
        [convId]: messagesByConversation.value[convId].map(m => {
          if (m.msgId === msgId) {
            return recalledMessage
          }
          return m
        })
      }
    }
  }

  async function handleIncomingMarkRead(userUuid: string, notice: any): Promise<void> {
    const convId = notice.convId
    conversations.value = conversations.value.map(c => {
      if (c.convId === convId) {
        return {
          ...c,
          payload: {
            ...c.payload,
            unread: 0
          }
        }
      }
      return c
    })
  }

  // 对端已读回执（MSG_READ_RECEIPT）：单调推进 convId 的对端已读位点。
  function handleIncomingReadReceipt(notice: { convId: string; readSeq: number }): void {
    const convId = notice.convId
    const readSeq = Number(notice.readSeq) || 0
    if (!convId || readSeq <= 0) {
      return
    }

    const current = peerReadSeqByConversation.value[convId] ?? 0
    if (readSeq <= current) {
      return
    }

    peerReadSeqByConversation.value = {
      ...peerReadSeqByConversation.value,
      [convId]: readSeq
    }
  }

  function updateConversationPreview(convId: string, previewText: string, timestamp: number) {
    conversations.value = conversations.value.map(c => {
      if (c.convId === convId) {
        return {
          ...c,
          payload: {
            ...c.payload,
            preview: previewText
          },
          updatedAt: timestamp
        }
      }
      return c
    })
    conversations.value = sortConversations(conversations.value)
  }

  function getConversationTitle(row: ConversationRow): string {
    const convType = Number(row.payload.convType)
    const targetUuid = String(row.payload.targetUuid)

    if (convType === 2) {
      const groupStore = useGroupStore()
      const group = groupStore.groups.find(g => g.groupUuid === targetUuid)
      if (group) return group.name
      return getString(row.payload, 'title', `群聊 (${targetUuid.substring(0, 4)})`)
    } else {
      const friendStore = useFriendStore()
      const friend = friendStore.friends.find(f => f.peerUuid === targetUuid)
      if (friend) {
        const remark = String(friend.payload.remark || '')
        const nickname = String(friend.payload.nickname || '')
        return remark.trim() || nickname.trim() || `单聊 (${targetUuid.substring(0, 4)})`
      }
      return getString(row.payload, 'title', `单聊 (${targetUuid.substring(0, 4)})`)
    }
  }

  function getConversationAvatar(row: ConversationRow): string {
    const convType = Number(row.payload.convType)
    const targetUuid = String(row.payload.targetUuid)

    if (convType === 2) {
      const groupStore = useGroupStore()
      const group = groupStore.groups.find(g => g.groupUuid === targetUuid)
      return group?.avatar || ''
    } else {
      const friendStore = useFriendStore()
      const friend = friendStore.friends.find(f => f.peerUuid === targetUuid)
      return String(friend?.payload?.avatar || '')
    }
  }

  function getConversationPreview(row: ConversationRow): string {
    return getString(row.payload, 'preview')
  }

  function getConversationUnread(row: ConversationRow): number {
    return getNumber(row.payload, 'unread')
  }

  async function clearState(): Promise<void> {
    if (draftSaveTimer) {
      clearTimeout(draftSaveTimer)
      draftSaveTimer = null
    }
    currentUserUuid.value = ''
    conversations.value = []
    messagesByConversation.value = {}
    olderHistoryExhaustedByConversation.value = {}
    activeConvId.value = ''
    activeDraft.value = ''
    loading.value = false
    loadingOlderMessages.value = false
    localDBAvailable.value = true
    peerReadSeqByConversation.value = {}
  }

  async function startConversation(targetUuid: string, convType: number): Promise<string> {
    const userUuid = currentUserUuid.value
    const normalizedTargetUuid = targetUuid.trim()
    if (!userUuid) {
      throw new Error('缺少当前用户，无法创建会话')
    }
    if (!normalizedTargetUuid) {
      throw new Error('缺少聊天对象')
    }

    let convId = ''
    if (convType === 2) {
      convId = normalizedTargetUuid
    } else {
      convId = buildP2PConversationId(userUuid, normalizedTargetUuid)
    }

    const found = conversations.value.find(c => c.convId === convId)
    if (!found) {
      const newConv: ConversationRow = {
        userUuid,
        convId,
        payload: {
          title: convType === 2 ? '群聊' : '单聊',
          preview: '',
          unread: 0,
          mute: false,
          pin: false,
          convType,
          targetUuid: normalizedTargetUuid,
          avatarColor: convType === 2 ? '#6ca06f' : '#7d8da5'
        },
        updatedAt: Date.now()
      }
      conversations.value = [newConv, ...conversations.value]
      await safeWrite(() => window.api.localdb.chat.upsertConversations(userUuid, [newConv]))
    }

    activeConvId.value = convId
    await openConversation(convId)
    return convId
  }

  return {
    currentUserUuid,
    conversations,
    activeConvId,
    activeDraft,
    activeConversation,
    activeMessages,
    loading,
    loadingOlderMessages,
    activeHasMoreBefore,
    localDBAvailable,
    peerReadSeqByConversation,
    bootstrap,
    openConversation,
    loadOlderMessages,
    setDraft,
    sendMessage,
    resendMessage,
    recallMessage,
    deleteConv,
    updateConvSettings,
    getConversationTitle,
    getConversationAvatar,
    getConversationPreview,
    getConversationUnread,
    clearState,
    handleIncomingMessage,
    handleIncomingRecall,
    handleIncomingMarkRead,
    handleIncomingReadReceipt,
    syncConversationsFromServer,
    startConversation,
    playNotificationSound
  }
})
