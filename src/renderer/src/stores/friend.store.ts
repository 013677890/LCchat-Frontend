import { ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { FriendChangeRow, FriendRow } from '../../../shared/types/localdb'

export const useFriendStore = defineStore('friend', () => {
  const friends = shallowRef<FriendRow[]>([])
  const version = ref(0)

  async function loadFriends(userUuid: string): Promise<void> {
    if (!userUuid) {
      friends.value = []
      return
    }

    try {
      friends.value = await window.api.localdb.friends.getList(userUuid)
    } catch (error) {
      console.warn('load friends from localdb failed', error)
      friends.value = []
    }
  }

  async function replaceAll(userUuid: string, items: FriendRow[], latestVersion: number): Promise<void> {
    try {
      await window.api.localdb.friends.replaceAll(userUuid, items, latestVersion)
    } catch (error) {
      console.warn('replace friends in localdb failed', error)
    }
    friends.value = [...items]
    version.value = latestVersion
  }

  async function applyChanges(
    userUuid: string,
    changes: FriendChangeRow[],
    latestVersion: number
  ): Promise<void> {
    try {
      await window.api.localdb.friends.applyChanges(userUuid, changes, latestVersion)
    } catch (error) {
      console.warn('apply friend changes in localdb failed', error)
    }
    await loadFriends(userUuid)
    version.value = latestVersion
  }

  return {
    friends,
    version,
    loadFriends,
    replaceAll,
    applyChanges
  }
})
