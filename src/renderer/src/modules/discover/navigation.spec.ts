import { describe, expect, it, vi } from 'vitest'
import { openChatConversation } from './navigation'

describe('openChatConversation', () => {
  it('opens the target conversation and navigates to chat', async () => {
    const sessionStore = {
      currentUserUuid: 'user-1',
      bootstrap: vi.fn().mockResolvedValue(undefined),
      startConversation: vi.fn().mockResolvedValue('conv-1')
    }
    const router = {
      push: vi.fn().mockResolvedValue(undefined)
    }

    await openChatConversation({
      sessionStore: sessionStore as any,
      router: router as any,
      targetUuid: ' peer-1 ',
      convType: 1
    })

    expect(sessionStore.startConversation).toHaveBeenCalledWith('peer-1', 1)
    expect(sessionStore.bootstrap).not.toHaveBeenCalled()
    expect(router.push).toHaveBeenCalledWith('/')
  })

  it('bootstraps the session store when the current user is not loaded yet', async () => {
    const sessionStore = {
      currentUserUuid: '',
      bootstrap: vi.fn().mockResolvedValue(undefined),
      startConversation: vi.fn().mockResolvedValue('conv-1')
    }
    const router = {
      push: vi.fn().mockResolvedValue(undefined)
    }

    await openChatConversation({
      sessionStore: sessionStore as any,
      router: router as any,
      targetUuid: 'peer-1',
      convType: 1,
      currentUserUuid: 'user-1'
    })

    expect(sessionStore.bootstrap).toHaveBeenCalledWith('user-1')
    expect(sessionStore.startConversation).toHaveBeenCalledWith('peer-1', 1)
    expect(router.push).toHaveBeenCalledWith('/')
  })

  it('rejects empty targets without navigating', async () => {
    const sessionStore = {
      currentUserUuid: 'user-1',
      bootstrap: vi.fn(),
      startConversation: vi.fn()
    }
    const router = {
      push: vi.fn()
    }

    await expect(
      openChatConversation({
        sessionStore: sessionStore as any,
        router: router as any,
        targetUuid: ' ',
        convType: 1
      })
    ).rejects.toThrow('缺少聊天对象')

    expect(sessionStore.startConversation).not.toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()
  })
})
