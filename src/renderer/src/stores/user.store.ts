import { shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { JsonObject, ProfileRow } from '../../../shared/types/localdb'
import {
  fetchMyProfile,
  fetchMyQRCode,
  parseQRCode,
  updateMyProfile,
  uploadMyAvatar
} from '../modules/profile/api'
import type { UpdateMyProfileRequest, UserProfileDTO } from '../shared/types/user'
import { extractQRCodeToken } from '../shared/utils/qrcode'

export interface QRCodeState {
  qrCode: string
  token: string
  expireAt: string
}

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
  const qrCode = shallowRef<QRCodeState | null>(null)

  function reset(): void {
    profile.value = null
    qrCode.value = null
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

  async function uploadAvatar(userUuid: string, file: File): Promise<void> {
    if (!userUuid) {
      return
    }

    const response = await uploadMyAvatar(file)
    const avatarUrl =
      typeof response.data.avatarUrl === 'string' ? response.data.avatarUrl.trim() : ''
    if (!avatarUrl) {
      return
    }

    const basePayload = profile.value?.payload ?? {}
    await saveProfile(userUuid, {
      ...basePayload,
      avatar: avatarUrl
    })
  }

  async function loadQRCode(): Promise<void> {
    const response = await fetchMyQRCode()
    const qrCodeUrl = typeof response.data.qrCode === 'string' ? response.data.qrCode.trim() : ''
    if (!qrCodeUrl) {
      qrCode.value = null
      return
    }

    qrCode.value = {
      qrCode: qrCodeUrl,
      token: extractQRCodeToken(qrCodeUrl),
      expireAt: typeof response.data.expireAt === 'string' ? response.data.expireAt : ''
    }
  }

  async function parseQRCodeToUserUuid(input: string): Promise<string> {
    const token = extractQRCodeToken(input)
    if (!token) {
      throw new Error('请输入二维码链接或 Token')
    }

    const response = await parseQRCode({ token })
    const userUuid = typeof response.data.uuid === 'string' ? response.data.uuid.trim() : ''
    if (!userUuid) {
      throw new Error('二维码解析失败，请重试')
    }
    return userUuid
  }

  return {
    profile,
    qrCode,
    reset,
    loadProfile,
    saveProfile,
    syncFromServer,
    updateProfile,
    uploadAvatar,
    loadQRCode,
    parseQRCodeToUserUuid
  }
})
