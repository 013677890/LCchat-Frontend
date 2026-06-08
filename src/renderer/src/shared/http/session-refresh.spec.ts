import { beforeEach, describe, expect, it, vi } from 'vitest'
import { refreshSessionToken } from './session-refresh'

const axiosMocks = vi.hoisted(() => {
  const post = vi.fn()
  return {
    post,
    create: vi.fn(() => ({ post }))
  }
})

vi.mock('axios', () => ({
  default: {
    create: axiosMocks.create
  }
}))

const sessionGetMock = vi.fn()
const sessionSetMock = vi.fn()

function setupWindowApi(): void {
  ;(globalThis as { window?: unknown }).window = {
    api: {
      session: {
        get: sessionGetMock,
        set: sessionSetMock
      }
    }
  }
}

describe('refreshSessionToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionGetMock.mockResolvedValue({
      userUuid: 'user-1',
      accessToken: 'old-access',
      refreshToken: 'refresh-token',
      expiresAt: 0,
      deviceId: 'device-1'
    })
    sessionSetMock.mockResolvedValue(undefined)
    setupWindowApi()
  })

  it('does not call refresh endpoint without a device id', async () => {
    sessionGetMock.mockResolvedValueOnce({
      userUuid: 'user-1',
      accessToken: 'old-access',
      refreshToken: 'refresh-token',
      expiresAt: 0,
      deviceId: ''
    })

    await expect(refreshSessionToken()).resolves.toBeNull()

    expect(axiosMocks.post).not.toHaveBeenCalled()
    expect(sessionSetMock).not.toHaveBeenCalled()
  })

  it('sends uuid, device_id and refreshToken required by the gateway contract', async () => {
    axiosMocks.post.mockResolvedValueOnce({
      data: {
        code: 0,
        message: 'ok',
        trace_id: 'trace-refresh',
        timestamp: Date.now(),
        data: {
          accessToken: 'new-access',
          tokenType: 'Bearer',
          expiresIn: 60
        }
      }
    })

    const nextSession = await refreshSessionToken()

    expect(axiosMocks.post).toHaveBeenCalledWith(
      '/api/v1/public/user/refresh-token',
      {
        uuid: 'user-1',
        device_id: 'device-1',
        refreshToken: 'refresh-token'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Device-ID': 'device-1'
        }
      }
    )
    expect(nextSession?.accessToken).toBe('new-access')
    expect(sessionSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userUuid: 'user-1',
        accessToken: 'new-access',
        refreshToken: 'refresh-token',
        deviceId: 'device-1'
      })
    )
  })
})
