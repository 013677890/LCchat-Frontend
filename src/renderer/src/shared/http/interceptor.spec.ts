import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { installHttpInterceptors } from './interceptor'
import { refreshSessionToken } from './session-refresh'
import { onSessionChanged } from './session-events'

vi.mock('./session-refresh', () => ({
  refreshSessionToken: vi.fn()
}))

const refreshSessionTokenMock = refreshSessionToken as unknown as Mock
const sessionClearMock = vi.fn().mockResolvedValue(undefined)

function setupWindowApi(): void {
  ;(globalThis as { window?: unknown }).window = {
    api: {
      session: {
        clear: sessionClearMock
      }
    }
  }
}

type ResponseRejectedHandler = (error: unknown) => Promise<unknown>

function createAxiosInstanceHarness(): {
  instance: {
    request: Mock
  }
  rejectResponse: ResponseRejectedHandler
} {
  const handlers: {
    responseRejected?: ResponseRejectedHandler
  } = {}
  const instance = {
    interceptors: {
      request: {
        use: vi.fn()
      },
      response: {
        use: vi.fn((_fulfilled, rejected) => {
          handlers.responseRejected = rejected
        })
      }
    },
    request: vi.fn()
  }

  installHttpInterceptors(instance as any)

  const responseRejected = handlers.responseRejected
  if (!responseRejected) {
    throw new Error('response interceptor was not installed')
  }

  return {
    instance,
    rejectResponse: responseRejected
  }
}

describe('http interceptor session invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupWindowApi()
  })

  it('clears persisted and in-memory session when refresh returns no access token', async () => {
    refreshSessionTokenMock.mockResolvedValueOnce(null)
    const events: unknown[] = []
    const unsubscribe = onSessionChanged((session) => {
      events.push(session)
    })
    const { instance, rejectResponse } = createAxiosInstanceHarness()

    await expect(
      rejectResponse({
        isAxiosError: true,
        response: {
          status: 401
        },
        config: {
          url: '/api/v1/auth/user/profile',
          headers: {}
        }
      })
    ).rejects.toThrow('登录状态已失效，请重新登录')

    unsubscribe()
    expect(refreshSessionTokenMock).toHaveBeenCalledTimes(1)
    expect(sessionClearMock).toHaveBeenCalledTimes(1)
    expect(events).toEqual([null])
    expect(instance.request).not.toHaveBeenCalled()
  })
})
