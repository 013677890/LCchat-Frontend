import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from './auth.store'
import { useApplyStore } from './apply.store'
import { useConnStore } from './conn.store'
import { useFriendStore } from './friend.store'
import { useGroupStore } from './group.store'
import { useSessionStore } from './session.store'
import { decodeMessageEnvelope } from '../shared/utils/pb-codec'
import { fetchGroupList, fetchGroupMembers } from '../modules/group/api'

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

vi.mock('../modules/group/api', () => ({
  addGroupMembers: vi.fn(),
  applyJoinGroup: vi.fn(),
  cancelJoinGroupApplication: vi.fn(),
  createGroup: vi.fn(),
  dismissGroup: vi.fn(),
  fetchGroupInfo: vi.fn(),
  fetchGroupList: vi.fn(),
  fetchGroupMemberIDs: vi.fn(),
  fetchGroupMembers: vi.fn(),
  fetchJoinRequestPendingCount: vi.fn(),
  fetchJoinRequests: vi.fn(),
  fetchMyJoinGroupApplication: vi.fn(),
  fetchMyJoinGroupApplications: vi.fn(),
  fetchReviewedJoinRequests: vi.fn(),
  leaveGroup: vi.fn(),
  muteGroupMember: vi.fn(),
  removeGroupMember: vi.fn(),
  reviewJoinGroup: vi.fn(),
  searchGroupMembers: vi.fn(),
  searchGroups: vi.fn(),
  transferGroupOwner: vi.fn(),
  updateGroupInfo: vi.fn(),
  updateGroupMemberNickname: vi.fn(),
  updateGroupMuteSetting: vi.fn(),
  updateGroupNotice: vi.fn(),
  updateMemberRole: vi.fn(),
  updateMyGroupNickname: vi.fn()
}))

const decodeMessageEnvelopeMock = vi.mocked(decodeMessageEnvelope)
const fetchGroupListMock = vi.mocked(fetchGroupList)
const fetchGroupMembersMock = vi.mocked(fetchGroupMembers)

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

  it('refreshes the active member list when group websocket events can change chat membership', async () => {
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
    fetchGroupListMock.mockResolvedValue({
      data: {
        groups: [
          {
            groupUuid: 'group-1',
            name: '测试群',
            avatar: '',
            notice: '',
            ownerUuid: 'user-1',
            memberCount: 2,
            addMode: 0,
            muteAll: false
          }
        ]
      }
    } as never)
    fetchGroupMembersMock.mockResolvedValue({
      data: {
        members: [
          {
            userUuid: 'member-1',
            role: 0,
            nickname: '更新后的成员',
            avatar: '',
            groupNickname: '',
            muteUntil: 0
          }
        ]
      }
    } as never)
    groupStore.activeGroup = {
      groupUuid: 'group-1',
      name: '测试群',
      avatar: '',
      notice: '',
      ownerUuid: 'user-1',
      memberCount: 2,
      addMode: 0,
      muteAll: false
    }

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const connStore = useConnStore()
    connStore.connect()
    expect(consoleLogSpy.mock.calls.flat().join(' ')).not.toContain('access-token')

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

    expect(fetchGroupListMock).toHaveBeenCalledTimes(1)
    expect(fetchGroupMembersMock).toHaveBeenCalledWith('group-1')
    expect(groupStore.activeMembers).toEqual([
      expect.objectContaining({ userUuid: 'member-1', nickname: '更新后的成员' })
    ])
    expect(syncConversationsSpy).toHaveBeenCalledWith('user-1')
    connStore.disconnect()
  })
})
