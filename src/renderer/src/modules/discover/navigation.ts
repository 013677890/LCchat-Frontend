import type { Router } from 'vue-router'
import type { useSessionStore } from '../../stores/session.store'

interface OpenChatConversationOptions {
  sessionStore: ReturnType<typeof useSessionStore>
  router: Router
  targetUuid: string
  convType: number
}

export async function openChatConversation({
  sessionStore,
  router,
  targetUuid,
  convType
}: OpenChatConversationOptions): Promise<void> {
  const normalizedTargetUuid = targetUuid.trim()
  if (!normalizedTargetUuid) {
    throw new Error('缺少聊天对象')
  }

  await sessionStore.startConversation(normalizedTargetUuid, convType)
  await router.push('/')
}
