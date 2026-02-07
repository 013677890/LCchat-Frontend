import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from './auth.store'
import { login } from '../modules/auth/api'

vi.mock('../modules/auth/api', () => ({
  login: vi.fn(),
  loginByCode: vi.fn(),
  register: vi.fn(),
  resetPassword: vi.fn(),
  sendVerifyCode: vi.fn()
}))

vi.mock('../modules/security/api', () => ({
  logout: vi.fn()
}))

const loginMock = vi.mocked(login)

const sessionGetMock = vi.fn().mockResolvedValue(null)
const sessionSetMock = vi.fn().mockResolvedValue(undefined)
const sessionClearMock = vi.fn().mockResolvedValue(undefined)
const deviceIdMock = vi.fn().mockResolvedValue('device-test')
const localdbInitMock = vi.fn().mockResolvedValue(undefined)

function setupWindowApi(): void {
  ;(globalThis as { window?: unknown }).window = {
    api: {
      session: {
        get: sessionGetMock,
        set: sessionSetMock,
        clear: sessionClearMock
      },
      device: {
        getId: deviceIdMock
      },
      localdb: {
        init: localdbInitMock
      }
    }
  }
}

describe('auth.store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    setupWindowApi()
  })

  it('keeps session empty when backend returns auth failure', async () => {
    loginMock.mockRejectedValueOnce(new Error('401 unauthorized'))
    const store = useAuthStore()

    await expect(store.signInWithPassword('demo@test.com', '123456')).rejects.toThrow(
      '401 unauthorized'
    )

    expect(store.session).toBeNull()
    expect(sessionSetMock).not.toHaveBeenCalled()
    expect(localdbInitMock).not.toHaveBeenCalled()
  })

  it('keeps session empty when request times out', async () => {
    loginMock.mockRejectedValueOnce(new Error('timeout of 10000ms exceeded'))
    const store = useAuthStore()

    await expect(store.signInWithPassword('demo@test.com', '123456')).rejects.toThrow(
      'timeout of 10000ms exceeded'
    )

    expect(store.session).toBeNull()
    expect(sessionSetMock).not.toHaveBeenCalled()
    expect(localdbInitMock).not.toHaveBeenCalled()
  })
})
