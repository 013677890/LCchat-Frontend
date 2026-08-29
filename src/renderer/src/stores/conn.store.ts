import { ref } from 'vue'
import { defineStore } from 'pinia'
import { toast } from 'vue-sonner'
import { useAuthStore } from './auth.store'
import { useSessionStore } from './session.store'
import { useFriendStore } from './friend.store'
import { useApplyStore } from './apply.store'
import { useGroupStore } from './group.store'
import { useAppStore } from './app.store'
import { refreshSessionToken } from '../shared/http/session-refresh'
import {
  decodeMessageEnvelope,
  encodeMessageEnvelope,
  encodeMessageAck,
  decodeMsgItem,
  decodeRecallNotice,
  decodeMarkReadNotice,
  decodeErrorFrame
} from '../shared/utils/pb-codec'

// 连续握手失败达到该阈值后先刷新 token 再重连；刷新失败则判定登录态失效。
const MAX_HANDSHAKE_FAILURES_BEFORE_REFRESH = 2

export const useConnStore = defineStore('conn', () => {
  const status = ref<'idle' | 'connecting' | 'connected' | 'reconnecting' | 'auth_failed'>('idle')
  const lastActiveTime = ref(Date.now())

  let ws: WebSocket | null = null
  let heartbeatTimer: any = null
  let heartbeatTimeoutTimer: any = null
  let reconnectTimer: any = null
  let reconnectDelay = 1000
  // 记录连续"未成功建立即关闭"的次数，用于识别握手层失败（如 token 失效被拒 401）。
  let consecutiveHandshakeFailures = 0

  const authStore = useAuthStore()

  function getWsUrl(): string {
    const gatewayUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'
    const explicitWsUrl = import.meta.env.VITE_WS_BASE_URL
    const token = authStore.session?.accessToken ?? ''
    const deviceId = authStore.session?.deviceId ?? ''

    let baseUrl = 'ws://localhost:8081'

    try {
      const parsed = new URL(explicitWsUrl || gatewayUrl)
      const protocol = parsed.protocol === 'wss:' || parsed.protocol === 'https:' ? 'wss:' : 'ws:'
      const port = explicitWsUrl || parsed.port !== '8080' ? parsed.port : '8081'
      const host = port ? `${parsed.hostname}:${port}` : parsed.hostname
      const path = explicitWsUrl ? parsed.pathname.replace(/\/$/, '') : ''
      baseUrl = `${protocol}//${host}${path}`
    } catch (e) {
      console.warn('Failed to parse WebSocket base URL, using defaults', e)
    }

    return `${baseUrl}/ws?token=${encodeURIComponent(token)}&device_id=${encodeURIComponent(deviceId)}`
  }

  function connect() {
    if (status.value === 'connected' || status.value === 'connecting') {
      return
    }

    if (!authStore.isAuthenticated) {
      status.value = 'idle'
      return
    }

    cleanup()
    status.value = status.value === 'reconnecting' ? 'reconnecting' : 'connecting'

    const url = getWsUrl()
    console.log('[WS] Connecting')

    try {
      ws = new WebSocket(url)
      ws.binaryType = 'arraybuffer'
      let opened = false

      ws.onopen = () => {
        console.log('[WS] Connection established')
        opened = true
        consecutiveHandshakeFailures = 0
        status.value = 'connected'
        lastActiveTime.value = Date.now()
        reconnectDelay = 1000
        startHeartbeat()

        // When connected/reconnected, perform a sync pull for safety
        const userUuid = authStore.userUuid
        if (userUuid) {
          useSessionStore().syncConversationsFromServer(userUuid)
          useFriendStore().syncFromServer(userUuid)
          useApplyStore().syncInboxFromServer(userUuid)
          useGroupStore().syncGroups()
        }
      }

      ws.onmessage = async (event) => {
        if (!(event.data instanceof ArrayBuffer)) {
          console.warn('[WS] Received non-binary frame')
          return
        }

        try {
          const buf = new Uint8Array(event.data)
          const envelope = decodeMessageEnvelope(buf)
          lastActiveTime.value = Date.now()

          await handleEnvelope(envelope)
        } catch (err) {
          console.error('[WS] Failed to decode or handle message envelope', err)
        }
      }

      ws.onclose = (event) => {
        console.warn('[WS] Connection closed:', event.code, event.reason)
        cleanup()

        // If JWT expired, set auth_failed
        if (event.code === 4001 || event.code === 20002) {
          status.value = 'auth_failed'
          return
        }

        // 从未 open 就关闭，通常是握手被拒（token 失效 401 → 浏览器只给 1006）。
        if (!opened) {
          consecutiveHandshakeFailures += 1
        }

        if (status.value !== 'idle') {
          status.value = 'reconnecting'
          scheduleReconnect()
        }
      }

      ws.onerror = (err) => {
        console.error('[WS] Connection error:', err)
      }
    } catch (err) {
      console.error('[WS] Failed to create WebSocket instance', err)
      status.value = 'reconnecting'
      scheduleReconnect()
    }
  }

  function disconnect() {
    status.value = 'idle'
    cleanup()
    if (ws) {
      try {
        ws.close(1000, 'User logged out')
      } catch (e) {
        // Ignore
      }
      ws = null
    }
  }

  function cleanup() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
    if (heartbeatTimeoutTimer) {
      clearTimeout(heartbeatTimeoutTimer)
      heartbeatTimeoutTimer = null
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  function startHeartbeat() {
    heartbeatTimer = setInterval(() => {
      if (!ws || status.value !== 'connected') return

      try {
        const envelope = encodeMessageEnvelope({
          type: 'heartbeat',
          seq: 0
        })
        ws.send(envelope)

        // Timeout if no response in 10s
        heartbeatTimeoutTimer = setTimeout(() => {
          console.warn('[WS] Heartbeat timeout, closing connection')
          cleanup()
          if (ws) ws.close()
        }, 10000)
      } catch (err) {
        console.error('[WS] Failed to send heartbeat', err)
      }
    }, 30000)
  }

  function scheduleReconnect() {
    cleanup()
    console.log(`[WS] Scheduling reconnect in ${reconnectDelay}ms`)
    reconnectTimer = setTimeout(async () => {
      reconnectDelay = Math.min(reconnectDelay * 2, 30000)
      await refreshTokenIfNeeded()
      if (status.value === 'auth_failed' || status.value === 'idle') {
        return
      }
      connect()
    }, reconnectDelay)
  }

  // 重连前检查登录态：token 已过期或连续握手失败时先走刷新。
  // connect 服务握手只校验 AccessToken JWT 与 device_id；旧 AccessToken 在过期前仍可重连。
  // 刷新失败（refresh token 失效/设备被踢）则停止重连并标记 auth_failed，
  // 由 UI 引导用户重新登录，避免无限重连循环。
  async function refreshTokenIfNeeded(): Promise<void> {
    const session = authStore.session
    if (!session) {
      status.value = 'auth_failed'
      return
    }

    const tokenExpired = session.expiresAt > 0 && session.expiresAt <= Date.now()
    const handshakeKeepsFailing =
      consecutiveHandshakeFailures >= MAX_HANDSHAKE_FAILURES_BEFORE_REFRESH
    if (!tokenExpired && !handshakeKeepsFailing) {
      return
    }

    try {
      const nextSession = await refreshSessionToken()
      if (!nextSession?.accessToken) {
        status.value = 'auth_failed'
        return
      }
      consecutiveHandshakeFailures = 0
    } catch (err) {
      console.warn('[WS] Refresh token before reconnect failed', err)
      status.value = 'auth_failed'
    }
  }

  async function handleEnvelope(envelope: any) {
    const type = envelope.type
    const userUuid = authStore.userUuid
    if (!userUuid) return

    const sessionStore = useSessionStore()
    const friendStore = useFriendStore()
    const applyStore = useApplyStore()
    const groupStore = useGroupStore()

    switch (type) {
      case 'heartbeat_ack':
        if (heartbeatTimeoutTimer) {
          clearTimeout(heartbeatTimeoutTimer)
          heartbeatTimeoutTimer = null
        }
        break

      case 'MSG_PUSH': {
        const msgItem = decodeMsgItem(envelope.data)
        console.log('[WS] Received MSG_PUSH:', msgItem)
        const ackSeq = await sessionStore.handleIncomingMessage(userUuid, msgItem)

        if (envelope.ackRequired && ackSeq > 0) {
          sendAck(msgItem.convId, ackSeq, msgItem.msgId)
        }
        break
      }

      case 'MSG_RECALL': {
        const recallNotice = decodeRecallNotice(envelope.data)
        console.log('[WS] Received MSG_RECALL:', recallNotice)
        await sessionStore.handleIncomingRecall(userUuid, recallNotice)
        break
      }

      case 'MSG_MARK_READ': {
        const markReadNotice = decodeMarkReadNotice(envelope.data)
        console.log('[WS] Received MSG_MARK_READ:', markReadNotice)
        await sessionStore.handleIncomingMarkRead(userUuid, markReadNotice)
        break
      }

      case 'MSG_READ_RECEIPT': {
        // P2P 对端已读回执：payload 与 MarkReadNotice 同构（convId + readSeq）。
        const readReceipt = decodeMarkReadNotice(envelope.data)
        console.log('[WS] Received MSG_READ_RECEIPT:', readReceipt)
        sessionStore.handleIncomingReadReceipt(readReceipt)
        break
      }

      case 'FRIEND_APPLY_CREATED': {
        console.log('[WS] Event: FRIEND_APPLY_CREATED')
        await applyStore.syncInboxFromServer(userUuid)
        sessionStore.playNotificationSound()

        const appStore = useAppStore()
        if (appStore.toastEnabled) {
          toast.info('您收到了一条新的好友申请！', {
            duration: 6000,
            action: {
              label: '去处理',
              onClick: () => {
                appStore.setActiveNav('contacts')
                appStore.setContactActiveTab('applies')
              }
            }
          })
        }
        break
      }

      case 'FRIEND_APPLY_HANDLED':
        console.log('[WS] Event: FRIEND_APPLY_HANDLED')
        await applyStore.syncSentFromServer(userUuid)
        break

      case 'FRIEND_RELATION_CHANGED':
        console.log('[WS] Event: FRIEND_RELATION_CHANGED')
        await friendStore.syncFromServer(userUuid)
        break

      case 'GROUP_JOIN_REQUEST_CREATED': {
        console.log('[WS] Event: GROUP_JOIN_REQUEST_CREATED')
        await groupStore.syncJoinRequests()
        sessionStore.playNotificationSound()

        const appStore = useAppStore()
        if (appStore.toastEnabled) {
          toast.info('收到新的群组加群申请！', {
            duration: 6000,
            action: {
              label: '去审批',
              onClick: () => {
                appStore.setActiveNav('contacts')
                appStore.setContactActiveTab('groups')
              }
            }
          })
        }
        break
      }

      case 'GROUP_JOIN_REQUEST_REVIEWED':
        console.log('[WS] Event: GROUP_JOIN_REQUEST_REVIEWED')
        await groupStore.syncJoinRequests()
        await groupStore.syncGroups()
        if (groupStore.activeGroup) {
          await groupStore.syncMembers(groupStore.activeGroup.groupUuid)
        }
        await sessionStore.syncConversationsFromServer(userUuid)
        break

      case 'GROUP_STATE_CHANGED':
      case 'GROUP_MEMBER_REMOVED':
      case 'GROUP_DISMISSED':
      case 'GROUP_MEMBER_MUTED':
        console.log('[WS] Event:', type)
        await groupStore.syncGroups()
        if (groupStore.activeGroup) {
          await groupStore.syncMembers(groupStore.activeGroup.groupUuid)
        }
        await sessionStore.syncConversationsFromServer(userUuid)
        break

      case 'error': {
        const errFrame = decodeErrorFrame(envelope.data)
        console.error('[WS] Error frame from server:', errFrame)
        break
      }

      default:
        console.warn('[WS] Unknown message type:', type)
    }
  }

  function sendAck(convId: string, seq: number, msgId: string) {
    if (!ws || status.value !== 'connected') return

    try {
      const ackPayload = encodeMessageAck({ convId, seq, msgId })
      const envelope = encodeMessageEnvelope({
        type: 'MSG_ACK',
        data: ackPayload,
        seq: 0
      })
      ws.send(envelope)
      console.log('[WS] Sent MSG_ACK for seq:', seq)
    } catch (err) {
      console.error('[WS] Failed to send MSG_ACK', err)
    }
  }

  return {
    status,
    lastActiveTime,
    connect,
    disconnect
  }
})
