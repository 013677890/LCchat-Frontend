import { shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { JsonObject, ProfileRow } from '../../../shared/types/localdb'
import { fetchMyProfile } from '../modules/profile/api'
import type { UserProfileDTO } from '../shared/types/user'

function toProfilePayload(userUuid: string, userInfo: UserProfileDTO): JsonObject {
  return {
    uuid: typeof userInfo.uuid === 'string' ? userInfo.uuid : userUuid,
    nickname: typeof userInfo.nickname === 'string' ? userInfo.nickname : '',
    telephone: typeof userInfo.telephone === 'string' ? userInfo.telephone : '',
    email: typeof userInfo.email === 'string' ? userInfo.email : '',
    avatar: typeof userInfo.avatar === 'string' ? userInfo.avatar : '',
    gender: typeof userInfo.gender === 'number' ? userInfo.gender : 0,
    signature: typeof userInfo.signature === 'string' ? userInfo.signature : '',
    birthday: typeof userInfo.birthday === 'string' ? userInfo.birthday : '',
    status: typeof userInfo.status === 'number' ? userInfo.status : 0
  }
}

export const useUserStore = defineStore('user', () => {
  const profile = shallowRef<ProfileRow | null>(null)

  function reset(): void {
    profile.value = null
  }

  async function loadProfile(userUuid: string): Promise<void> {
    if (!userUuid) {
      profile.value = null
      return
    }

    try {
      profile.value = await window.api.localdb.profile.get(userUuid)
    } catch (error) {
      console.warn('load profile from localdb failed', error)
      profile.value = null
    }
  }

  async function saveProfile(userUuid: string, payload: JsonObject): Promise<void> {
    const nextProfile: ProfileRow = {
      userUuid,
      payload,
      updatedAt: Date.now()
    }

    try {
      await window.api.localdb.profile.upsert(nextProfile)
    } catch (error) {
      console.warn('save profile to localdb failed', error)
    }
    profile.value = nextProfile
  }

  async function syncFromServer(userUuid: string): Promise<void> {
    if (!userUuid) {
      return
    }

    try {
      const response = await fetchMyProfile()
      const userInfo = response.data.userInfo
      if (!userInfo) {
        return
      }

      await saveProfile(userUuid, toProfilePayload(userUuid, userInfo))
    } catch (error) {
      console.warn('sync profile from server failed, keep local cache', error)
    }
  }

  return {
    profile,
    reset,
    loadProfile,
    saveProfile,
    syncFromServer
  }
})
