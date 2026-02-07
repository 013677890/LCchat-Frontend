import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useApplyStore } from './apply.store'
import {
  fetchFriendApplyList,
  fetchSentApplyList,
  fetchUnreadApplyCount
} from '../modules/contact/api'
import type { FriendApplyRow } from '../../../shared/types/localdb'

vi.mock('../modules/contact/api', () => ({
  fetchUnreadApplyCount: vi.fn(),
  fetchFriendApplyList: vi.fn(),
  fetchSentApplyList: vi.fn(),
  handleFriendApply: vi.fn(),
  markFriendApplyRead: vi.fn(),
  sendFriendApply: vi.fn()
}))

const fetchUnreadApplyCountMock = vi.mocked(fetchUnreadApplyCount)
const fetchFriendApplyListMock = vi.mocked(fetchFriendApplyList)
const fetchSentApplyListMock = vi.mocked(fetchSentApplyList)

const getInboxMock = vi.fn().mockResolvedValue([])
const upsertInboxMock = vi.fn().mockResolvedValue(undefined)
const replaceInboxMock = vi.fn().mockResolvedValue(undefined)
const getSentMock = vi.fn().mockResolvedValue([])
const upsertSentMock = vi.fn().mockResolvedValue(undefined)
const replaceSentMock = vi.fn().mockResolvedValue(undefined)

function setupWindowApi(): void {
  ;(globalThis as { window?: unknown }).window = {
    api: {
      localdb: {
        applies: {
          getInbox: getInboxMock,
          upsertInbox: upsertInboxMock,
          replaceInbox: replaceInboxMock,
          getSent: getSentMock,
          upsertSent: upsertSentMock,
          replaceSent: replaceSentMock
        }
      }
    }
  }
}

function createInboxRow(applyId: number, isRead: boolean): FriendApplyRow {
  return {
    userUuid: 'user-1',
    applyId,
    direction: 'inbox',
    status: 0,
    payload: {
      isRead
    },
    updatedAt: Date.now()
  }
}

describe('apply.store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    setupWindowApi()
  })

  it('falls back to local unread count when unread endpoint times out', async () => {
    fetchUnreadApplyCountMock.mockRejectedValueOnce(new Error('timeout'))

    const store = useApplyStore()
    await store.upsertInbox('user-1', [createInboxRow(1, false), createInboxRow(2, true)])
    await store.syncUnreadCountFromServer('user-1')

    expect(store.unreadCount).toBe(1)
    expect(store.unreadCountSynced).toBe(false)
  })

  it('stops inbox sync at page boundary and keeps local fallback flow', async () => {
    fetchFriendApplyListMock.mockImplementation(async ({ page = 1 } = {}) => {
      return {
        data: {
          items: [],
          pagination: {
            page,
            pageSize: 100,
            total: 99900,
            totalPages: 999
          }
        }
      } as never
    })
    fetchUnreadApplyCountMock.mockResolvedValue({
      data: {
        unreadCount: 0
      }
    } as never)

    const store = useApplyStore()
    await store.syncInboxFromServer('user-1')

    expect(fetchFriendApplyListMock).toHaveBeenCalledTimes(50)
    expect(fetchFriendApplyListMock.mock.calls[0]?.[0]).toEqual({
      status: -1,
      page: 1,
      pageSize: 100
    })
    expect(fetchFriendApplyListMock.mock.calls[49]?.[0]).toEqual({
      status: -1,
      page: 50,
      pageSize: 100
    })
    expect(replaceInboxMock).toHaveBeenCalledWith('user-1', [])
    expect(getInboxMock).not.toHaveBeenCalledWith('user-1')
    expect(store.unreadCount).toBe(0)
    expect(store.unreadCountSynced).toBe(true)
  })

  it('stops sent sync at page boundary and falls back to local sent list', async () => {
    fetchSentApplyListMock.mockImplementation(async ({ page = 1 } = {}) => {
      return {
        data: {
          items: [],
          pagination: {
            page,
            pageSize: 100,
            total: 99900,
            totalPages: 999
          }
        }
      } as never
    })

    const store = useApplyStore()
    await store.syncSentFromServer('user-1')

    expect(fetchSentApplyListMock).toHaveBeenCalledTimes(50)
    expect(fetchSentApplyListMock.mock.calls[0]?.[0]).toEqual({
      status: -1,
      page: 1,
      pageSize: 100
    })
    expect(fetchSentApplyListMock.mock.calls[49]?.[0]).toEqual({
      status: -1,
      page: 50,
      pageSize: 100
    })
    expect(replaceSentMock).toHaveBeenCalledWith('user-1', [])
    expect(getSentMock).not.toHaveBeenCalledWith('user-1')
  })

  it('clears stale local inbox when server returns empty list', async () => {
    getInboxMock.mockResolvedValueOnce([createInboxRow(101, false)])
    fetchFriendApplyListMock.mockResolvedValue({
      data: {
        items: [],
        pagination: {
          page: 1,
          pageSize: 100,
          total: 0,
          totalPages: 1
        }
      }
    } as never)
    fetchUnreadApplyCountMock.mockResolvedValue({
      data: {
        unreadCount: 0
      }
    } as never)

    const store = useApplyStore()
    await store.loadInbox('user-1')
    expect(store.inbox.length).toBe(1)

    await store.syncInboxFromServer('user-1')
    expect(replaceInboxMock).toHaveBeenCalledWith('user-1', [])
    expect(store.inbox).toEqual([])
  })
})
