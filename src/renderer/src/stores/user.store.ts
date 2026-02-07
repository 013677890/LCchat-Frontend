import { shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { JsonObject, ProfileRow } from '../../../shared/types/localdb'
import { fetchMyProfile, updateMyProfile } from '../modules/profile/api'
import type { UpdateMyProfileRequest, UserProfileDTO } from '../shared/types/user'

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

function normalizeUpdatePayload(payload: UpdateMyProfileRequest): UpdateMyProfileRequest {
  const normalized: UpdateMyProfileRequest = {}

  if (typeof payload.nickname === 'string') {
    normalized.nickname = payload.nickname.trim()
  }

  if (typeof payload.signature === 'string') {
    normalized.signature = payload.signature.trim()
  }

  if (typeof payload.birthday === 'string') {
    normalized.birthday = payload.birthday
  }

  if (payload.gender === 1 || payload.gender === 2 || payload.gender === 3) {
    normalized.gender = payload.gender
  }

  return normalized
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

  async function updateProfile(userUuid: string, payload: UpdateMyProfileRequest): Promise<void> {
    if (!userUuid) {
      return
    }

    const normalizedPayload = normalizeUpdatePayload(payload)
    const response = await updateMyProfile(normalizedPayload)
    const userInfo = response.data.userInfo

    if (userInfo) {
      await saveProfile(userUuid, toProfilePayload(userUuid, userInfo))
      return
    }

    const basePayload = profile.value?.payload ?? {}
    await saveProfile(userUuid, {
      ...basePayload,
      ...normalizedPayload
    })
  }

  return {
    profile,
    reset,
    loadProfile,
    saveProfile,
    syncFromServer,
    updateProfile
  }
})
