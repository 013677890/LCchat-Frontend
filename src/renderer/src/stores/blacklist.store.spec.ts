import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useBlacklistStore } from './blacklist.store'
import { fetchBlacklist } from '../modules/blacklist/api'
import type { BlacklistRow } from '../../../shared/types/localdb'

vi.mock('../modules/blacklist/api', () => ({
  addBlacklist: vi.fn(),
  fetchBlacklist: vi.fn(),
  removeBlacklist: vi.fn()
}))

const fetchBlacklistMock = vi.mocked(fetchBlacklist)

const getListMock = vi.fn().mockResolvedValue([])
const replaceAllMock = vi.fn().mockResolvedValue(undefined)

function setupWindowApi(): void {
  ;(globalThis as { window?: unknown }).window = {
    api: {
      localdb: {
        blacklist: {
          getList: getListMock,
          replaceAll: replaceAllMock
        }
      }
    }
  }
}

function createBlacklistRow(peerUuid: string): BlacklistRow {
  return {
    userUuid: 'user-1',
    peerUuid,
    payload: {
      uuid: peerUuid,
      nickname: peerUuid
    },
    updatedAt: Date.now()
  }
}

describe('blacklist.store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    setupWindowApi()
  })

  it('falls back to local blacklist cache when server request times out', async () => {
    const localRows = [createBlacklistRow('peer-local')]
    getListMock.mockResolvedValueOnce(localRows)
    fetchBlacklistMock.mockRejectedValueOnce(new Error('timeout'))

    const store = useBlacklistStore()
    await store.syncFromServer('user-1')

    expect(getListMock).toHaveBeenCalledWith('user-1')
    expect(replaceAllMock).not.toHaveBeenCalled()
    expect(store.items).toEqual(localRows)
  })

  it('stops full pull at pagination boundary', async () => {
    fetchBlacklistMock.mockImplementation(async ({ page = 1 } = {}) => {
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

    const store = useBlacklistStore()
    await store.syncFromServer('user-1')

    expect(fetchBlacklistMock).toHaveBeenCalledTimes(50)
    expect(fetchBlacklistMock.mock.calls[0]?.[0]).toEqual({
      page: 1,
      pageSize: 100
    })
    expect(fetchBlacklistMock.mock.calls[49]?.[0]).toEqual({
      page: 50,
      pageSize: 100
    })
    expect(replaceAllMock).toHaveBeenCalledWith('user-1', [])
    expect(getListMock).not.toHaveBeenCalled()
    expect(store.items).toEqual([])
  })
})
