import { describe, expect, it, vi } from 'vitest'
import { openChatConversation } from './navigation'

describe('openChatConversation', () => {
  it('opens the target conversation and navigates to chat', async () => {
    const sessionStore = {
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
    expect(router.push).toHaveBeenCalledWith('/')
  })

  it('rejects empty targets without navigating', async () => {
    const sessionStore = {
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
