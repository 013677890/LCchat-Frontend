import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { resetAuthenticatedState } from './authenticated-state'
import { useApplyStore } from './apply.store'
import { useBlacklistStore } from './blacklist.store'
import { useDeviceStore } from './device.store'
import { useFriendStore } from './friend.store'
import { useGroupStore } from './group.store'
import { usePresenceStore } from './presence.store'
import { useSessionStore } from './session.store'
import { useUserStore } from './user.store'

describe('resetAuthenticatedState', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('clears user-scoped frontend state after sign out', async () => {
    const userStore = useUserStore()
    const friendStore = useFriendStore()
    const blacklistStore = useBlacklistStore()
    const applyStore = useApplyStore()
    const groupStore = useGroupStore()
    const presenceStore = usePresenceStore()
    const deviceStore = useDeviceStore()
    const sessionStore = useSessionStore()

    userStore.profile = {
      userUuid: 'user-1',
      payload: { nickname: 'Alice' },
      updatedAt: 1
    }
    userStore.qrCode = {
      qrCode: 'qr',
      token: 'token',
      expireAt: 'tomorrow'
    }
    friendStore.friends = [
      {
        userUuid: 'user-1',
        peerUuid: 'peer-1',
        payload: { nickname: 'Bob' },
        version: 1,
        updatedAt: 1
      }
    ]
    friendStore.version = 10
    friendStore.syncCursor = 'cursor-1'
    blacklistStore.items = [
      {
        userUuid: 'user-1',
        peerUuid: 'peer-2',
        payload: { nickname: 'Blocked' },
        updatedAt: 1
      }
    ]
    applyStore.inbox = [
      {
        userUuid: 'user-1',
        applyId: 1,
        direction: 'inbox',
        status: 0,
        payload: { isRead: false },
        updatedAt: 1
      }
    ]
    applyStore.sent = [
      {
        userUuid: 'user-1',
        applyId: 2,
        direction: 'outbox',
        status: 0,
        payload: {},
        updatedAt: 1
      }
    ]
    applyStore.unreadCount = 1
    const group = {
      groupUuid: 'group-1',
      name: 'Group',
      avatar: '',
      notice: '',
      ownerUuid: 'user-1',
      memberCount: 2,
      addMode: 0,
      muteAll: false
    }
    groupStore.groups = [group]
    groupStore.activeGroup = group
    groupStore.activeMembers = [
      {
        userUuid: 'user-1',
        role: 1,
        nickname: 'Alice',
        avatar: '',
        groupNickname: '',
        muteUntil: 0
      }
    ]
    presenceStore.statusByUserUuid = {
      'peer-1': {
        userUuid: 'peer-1',
        isOnline: true,
        lastSeenAt: '',
        onlinePlatforms: []
      }
    }
    deviceStore.devices = [
      {
        deviceId: 'device-1',
        deviceName: 'PC',
        platform: 'windows',
        appVersion: '1.0.0',
        isCurrentDevice: true,
        status: 0,
        lastSeenAt: ''
      }
    ]
    deviceStore.loading = true
    sessionStore.currentUserUuid = 'user-1'
    sessionStore.conversations = [
      {
        userUuid: 'user-1',
        convId: 'conv-1',
        payload: { title: 'Chat' },
        updatedAt: 1
      }
    ]
    sessionStore.activeConvId = 'conv-1'
    sessionStore.activeDraft = 'draft'
    sessionStore.localDBAvailable = false

    await resetAuthenticatedState()

    expect(userStore.profile).toBeNull()
    expect(userStore.qrCode).toBeNull()
    expect(friendStore.friends).toEqual([])
    expect(friendStore.version).toBe(0)
    expect(friendStore.syncCursor).toBe('')
    expect(blacklistStore.items).toEqual([])
    expect(applyStore.inbox).toEqual([])
    expect(applyStore.sent).toEqual([])
    expect(applyStore.unreadCount).toBe(0)
    expect(groupStore.groups).toEqual([])
    expect(groupStore.activeGroup).toBeNull()
    expect(groupStore.activeMembers).toEqual([])
    expect(presenceStore.statusByUserUuid).toEqual({})
    expect(deviceStore.devices).toEqual([])
    expect(deviceStore.loading).toBe(false)
    expect(sessionStore.currentUserUuid).toBe('')
    expect(sessionStore.conversations).toEqual([])
    expect(sessionStore.activeConvId).toBe('')
    expect(sessionStore.activeDraft).toBe('')
    expect(sessionStore.localDBAvailable).toBe(true)
  })
})
