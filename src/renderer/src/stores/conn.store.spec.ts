import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from './auth.store'
import { useApplyStore } from './apply.store'
import { useConnStore } from './conn.store'
import { useFriendStore } from './friend.store'
import { useGroupStore } from './group.store'
import { useSessionStore } from './session.store'
import { decodeMessageEnvelope } from '../shared/utils/pb-codec'

vi.mock('vue-sonner', () => ({
  toast: {
    info: vi.fn()
  }
}))

vi.mock('../shared/utils/pb-codec', () => ({
  decodeMessageEnvelope: vi.fn(),
  encodeMessageEnvelope: vi.fn(() => new Uint8Array()),
  encodeMessageAck: vi.fn(() => new Uint8Array()),
  decodeMsgItem: vi.fn(),
  decodeRecallNotice: vi.fn(),
  decodeMarkReadNotice: vi.fn(),
  decodeErrorFrame: vi.fn()
}))

const decodeMessageEnvelopeMock = vi.mocked(decodeMessageEnvelope)

class FakeWebSocket {
  static instances: FakeWebSocket[] = []

  binaryType = ''
  onopen: (() => void) | null = null
  onmessage: ((event: { data: ArrayBuffer }) => void | Promise<void>) | null = null
  onclose: ((event: { code: number; reason: string }) => void) | null = null
  onerror: ((event: unknown) => void) | null = null

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this)
  }

  send(): void {}

  close(code = 1000, reason = ''): void {
    this.onclose?.({ code, reason })
  }
}

function setupAuthenticatedSession(): void {
  const authStore = useAuthStore()
  authStore.session = {
    userUuid: 'user-1',
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresAt: Date.now() + 60_000,
    deviceId: 'device-1'
  }
}

describe('conn.store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    FakeWebSocket.instances = []
    ;(globalThis as { WebSocket?: unknown }).WebSocket = FakeWebSocket
  })

  it('resyncs conversations when group websocket events can change chat membership', async () => {
    setupAuthenticatedSession()

    const sessionStore = useSessionStore()
    const friendStore = useFriendStore()
    const applyStore = useApplyStore()
    const groupStore = useGroupStore()
    const syncConversationsSpy = vi
      .spyOn(sessionStore, 'syncConversationsFromServer')
      .mockResolvedValue(undefined)
    vi.spyOn(friendStore, 'syncFromServer').mockResolvedValue(undefined)
    vi.spyOn(applyStore, 'syncInboxFromServer').mockResolvedValue(undefined)
    const syncGroupsSpy = vi.spyOn(groupStore, 'syncGroups').mockResolvedValue(undefined)

    const connStore = useConnStore()
    connStore.connect()

    const socket = FakeWebSocket.instances[0] as FakeWebSocket | undefined
    expect(socket).toBeTruthy()
    if (!socket) {
      throw new Error('WebSocket was not created')
    }
    socket.onopen?.()
    vi.clearAllMocks()

    decodeMessageEnvelopeMock.mockReturnValue({
      type: 'GROUP_DISMISSED',
      data: new Uint8Array(),
      seq: 0,
      serverTs: 0,
      traceId: '',
      ackRequired: false
    })

    await socket.onmessage?.({ data: new ArrayBuffer(0) })

    expect(syncGroupsSpy).toHaveBeenCalledTimes(1)
    expect(syncConversationsSpy).toHaveBeenCalledWith('user-1')
    connStore.disconnect()
  })
})
