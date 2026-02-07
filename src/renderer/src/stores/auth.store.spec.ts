import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from './auth.store'
import {
  login,
  loginByCode,
  register,
  resetPassword,
  sendVerifyCode,
  verifyCode
} from '../modules/auth/api'

vi.mock('../modules/auth/api', () => ({
  login: vi.fn(),
  loginByCode: vi.fn(),
  register: vi.fn(),
  resetPassword: vi.fn(),
  sendVerifyCode: vi.fn(),
  verifyCode: vi.fn()
}))

vi.mock('../modules/security/api', () => ({
  logout: vi.fn()
}))

const loginMock = vi.mocked(login)
const loginByCodeMock = vi.mocked(loginByCode)
const registerMock = vi.mocked(register)
const resetPasswordMock = vi.mocked(resetPassword)
const sendVerifyCodeMock = vi.mocked(sendVerifyCode)
const verifyCodeMock = vi.mocked(verifyCode)

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

  it('attaches persistent device id and device info on password login', async () => {
    loginMock.mockResolvedValueOnce({
      code: 0,
      message: 'ok',
      trace_id: 'trace-1',
      timestamp: Date.now(),
      data: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        userInfo: {
          uuid: 'user-1',
          nickname: 'Tester',
          telephone: '',
          email: 'demo@test.com',
          avatar: '',
          gender: 0,
          signature: '',
          birthday: '',
          status: 0
        }
      }
    })
    const store = useAuthStore()

    await store.signInWithPassword('demo@test.com', '123456')

    expect(loginMock).toHaveBeenCalledWith(
      expect.objectContaining({
        account: 'demo@test.com',
        password: '123456',
        deviceInfo: expect.objectContaining({
          deviceName: 'LCchat-device-test'
        })
      })
    )
    expect(sessionSetMock).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: 'device-test' })
    )
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

  it('calls send-verify-code and returns expire seconds', async () => {
    sendVerifyCodeMock.mockResolvedValueOnce({
      code: 0,
      message: 'ok',
      trace_id: 'trace-2',
      timestamp: Date.now(),
      data: {
        expireSeconds: 90
      }
    })
    const store = useAuthStore()

    await expect(store.requestVerifyCode('demo@test.com', 2)).resolves.toBe(90)
    expect(sendVerifyCodeMock).toHaveBeenCalledWith({
      email: 'demo@test.com',
      type: 2
    })
  })

  it('verifies code before login-by-code request', async () => {
    verifyCodeMock.mockResolvedValueOnce({
      code: 0,
      message: 'ok',
      trace_id: 'trace-3',
      timestamp: Date.now(),
      data: {
        valid: true
      }
    })
    loginByCodeMock.mockResolvedValueOnce({
      code: 0,
      message: 'ok',
      trace_id: 'trace-4',
      timestamp: Date.now(),
      data: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        userInfo: {
          uuid: 'user-2',
          nickname: 'CodeUser',
          telephone: '',
          email: 'demo@test.com',
          avatar: '',
          gender: 0,
          signature: '',
          birthday: '',
          status: 0
        }
      }
    })
    const store = useAuthStore()

    await store.signInWithCode('demo@test.com', '123456')

    expect(verifyCodeMock).toHaveBeenCalledWith({
      email: 'demo@test.com',
      verifyCode: '123456',
      type: 2
    })
    expect(loginByCodeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'demo@test.com',
        verifyCode: '123456'
      })
    )
  })

  it('does not submit register when verify-code returns invalid', async () => {
    verifyCodeMock.mockResolvedValueOnce({
      code: 0,
      message: 'ok',
      trace_id: 'trace-5',
      timestamp: Date.now(),
      data: {
        valid: false
      }
    })
    const store = useAuthStore()

    await expect(
      store.registerWithEmail({
        email: 'demo@test.com',
        verifyCode: '111111',
        password: '123456'
      })
    ).rejects.toThrow('验证码错误，请重新输入')

    expect(registerMock).not.toHaveBeenCalled()
  })

  it('verifies code before reset-password request', async () => {
    verifyCodeMock.mockResolvedValueOnce({
      code: 0,
      message: 'ok',
      trace_id: 'trace-6',
      timestamp: Date.now(),
      data: {
        valid: true
      }
    })
    resetPasswordMock.mockResolvedValueOnce({
      code: 0,
      message: 'ok',
      trace_id: 'trace-7',
      timestamp: Date.now(),
      data: null
    })
    const store = useAuthStore()

    await store.resetPasswordByEmail({
      email: 'demo@test.com',
      verifyCode: '123456',
      newPassword: 'new-password'
    })

    expect(verifyCodeMock).toHaveBeenCalledWith({
      email: 'demo@test.com',
      verifyCode: '123456',
      type: 3
    })
    expect(resetPasswordMock).toHaveBeenCalledWith({
      email: 'demo@test.com',
      verifyCode: '123456',
      newPassword: 'new-password'
    })
  })
})
