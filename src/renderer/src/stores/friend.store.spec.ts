import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useFriendStore } from './friend.store'
import { fetchFriendList, syncFriendList } from '../modules/contact/api'

vi.mock('../modules/contact/api', () => ({
  deleteFriend: vi.fn(),
  fetchFriendList: vi.fn(),
  setFriendRemark: vi.fn(),
  setFriendTag: vi.fn(),
  syncFriendList: vi.fn()
}))

const fetchFriendListMock = vi.mocked(fetchFriendList)
const syncFriendListMock = vi.mocked(syncFriendList)

const localdbGetListMock = vi.fn().mockResolvedValue([])
const localdbReplaceAllMock = vi.fn().mockResolvedValue(undefined)
const localdbApplyChangesMock = vi.fn().mockResolvedValue(undefined)

function setupWindowApi(): void {
  ;(globalThis as { window?: unknown }).window = {
    api: {
      localdb: {
        friends: {
          getList: localdbGetListMock,
          replaceAll: localdbReplaceAllMock,
          applyChanges: localdbApplyChangesMock
        }
      }
    }
  }
}

describe('friend.store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    setupWindowApi()
  })

  it('handles empty server list and keeps local cache contract consistent', async () => {
    fetchFriendListMock.mockResolvedValue({
      data: {
        items: [],
        pagination: {
          totalPages: 1
        },
        version: 12
      }
    } as never)
    syncFriendListMock.mockResolvedValue({
      data: {
        changes: [],
        hasMore: false,
        latestVersion: 12
      }
    } as never)

    const store = useFriendStore()
    await store.syncFromServer('user-1')

    expect(store.friends).toEqual([])
    expect(store.version).toBe(12)
    expect(fetchFriendListMock).toHaveBeenCalledTimes(1)
    expect(fetchFriendListMock).toHaveBeenCalledWith({
      page: 1,
      pageSize: 100
    })
    expect(syncFriendListMock).toHaveBeenCalledWith({
      version: 12,
      limit: 200
    })
    expect(localdbReplaceAllMock).toHaveBeenCalledWith('user-1', [], 12)
  })

  it('stops at pagination boundaries for full pull and incremental sync', async () => {
    fetchFriendListMock.mockImplementation(async ({ page = 1 } = {}) => {
      return {
        data: {
          items: [],
          pagination: {
            totalPages: 999
          },
          version: 3
        }
      } as never
    })
    syncFriendListMock.mockResolvedValue({
      data: {
        changes: [],
        hasMore: true,
        latestVersion: 3
      }
    } as never)

    const store = useFriendStore()
    await store.syncFromServer('user-1')

    expect(fetchFriendListMock).toHaveBeenCalledTimes(50)
    expect(fetchFriendListMock.mock.calls[0]?.[0]).toEqual({
      page: 1,
      pageSize: 100
    })
    expect(fetchFriendListMock.mock.calls[49]?.[0]).toEqual({
      page: 50,
      pageSize: 100
    })
    expect(syncFriendListMock).toHaveBeenCalledTimes(20)
    expect(localdbReplaceAllMock).toHaveBeenCalledTimes(1)
    expect(localdbApplyChangesMock).not.toHaveBeenCalled()
  })
})
