import { useApplyStore } from './apply.store'
import { useBlacklistStore } from './blacklist.store'
import { useDeviceStore } from './device.store'
import { useFriendStore } from './friend.store'
import { useGroupStore } from './group.store'
import { usePresenceStore } from './presence.store'
import { useSessionStore } from './session.store'
import { useUserStore } from './user.store'

export async function resetAuthenticatedState(): Promise<void> {
  useUserStore().reset()
  useFriendStore().reset()
  useBlacklistStore().reset()
  useApplyStore().reset()
  useGroupStore().reset()
  usePresenceStore().reset()
  useDeviceStore().reset()
  await useSessionStore().clearState()
}
