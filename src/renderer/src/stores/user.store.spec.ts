import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUserStore } from './user.store'
import { fetchMyProfile } from '../modules/profile/api'

vi.mock('../modules/profile/api', () => ({
  fetchMyProfile: vi.fn(),
  fetchMyQRCode: vi.fn(),
  parseQRCode: vi.fn(),
  updateMyProfile: vi.fn(),
  uploadMyAvatar: vi.fn()
}))

const fetchMyProfileMock = vi.mocked(fetchMyProfile)
const profileGetMock = vi.fn().mockResolvedValue(null)
const profileUpsertMock = vi.fn().mockResolvedValue(undefined)

function setupWindowApi(): void {
  ;(globalThis as { window?: unknown }).window = {
    api: {
      localdb: {
        profile: {
          get: profileGetMock,
          upsert: profileUpsertMock
        }
      }
    }
  }
}

describe('user.store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    setupWindowApi()
  })

  it('stores only profile fields exposed by the current user-service contract', async () => {
    fetchMyProfileMock.mockResolvedValueOnce({
      code: 0,
      message: 'ok',
      trace_id: 'trace-profile',
      timestamp: Date.now(),
      data: {
        userInfo: {
          uuid: 'user-1',
          nickname: 'Tester',
          avatar: '/avatar.png',
          gender: 3,
          signature: 'hello',
          birthday: '2026-06-08',
          email: 'legacy@example.com',
          telephone: '13800138000',
          status: 0
        }
      }
    })
    const store = useUserStore()

    await store.syncFromServer('user-1')

    expect(profileUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userUuid: 'user-1',
        payload: {
          uuid: 'user-1',
          nickname: 'Tester',
          avatar: expect.stringContaining('/avatar.png'),
          gender: 3,
          signature: 'hello',
          birthday: '2026-06-08'
        }
      })
    )
    expect(store.profile?.payload).not.toHaveProperty('email')
    expect(store.profile?.payload).not.toHaveProperty('telephone')
    expect(store.profile?.payload).not.toHaveProperty('status')
  })
})
