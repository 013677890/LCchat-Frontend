import type { Router } from 'vue-router'
import type { useSessionStore } from '../../stores/session.store'

interface OpenChatConversationOptions {
  sessionStore: ReturnType<typeof useSessionStore>
  router: Router
  targetUuid: string
  convType: number
  currentUserUuid?: string
}

export async function openChatConversation({
  sessionStore,
  router,
  targetUuid,
  convType,
  currentUserUuid
}: OpenChatConversationOptions): Promise<void> {
  const normalizedTargetUuid = targetUuid.trim()
  if (!normalizedTargetUuid) {
    throw new Error('缺少聊天对象')
  }

  const normalizedUserUuid = currentUserUuid?.trim()
  if (normalizedUserUuid && sessionStore.currentUserUuid !== normalizedUserUuid) {
    await sessionStore.bootstrap(normalizedUserUuid)
  }

  await sessionStore.startConversation(normalizedTargetUuid, convType)
  await router.push('/')
}
