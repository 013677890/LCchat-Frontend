import { shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { JsonObject, ProfileRow } from '../../../shared/types/localdb'

export const useUserStore = defineStore('user', () => {
  const profile = shallowRef<ProfileRow | null>(null)

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

  return {
    profile,
    loadProfile,
    saveProfile
  }
})
