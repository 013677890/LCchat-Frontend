import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue'
import type { BlacklistRow, SessionData } from '../../../../../shared/types/localdb'
import type { UpdateMyProfileRequest } from '../../../shared/types/user'
import { changeEmail, changePassword, deleteAccount } from '../../security/api'
import { isSendTooFrequentError, resolveSecurityErrorMessage } from '../../security/error-message'
import { resolveRelationErrorMessage } from '../../contact/error-message'
import type { useAuthStore } from '../../../stores/auth.store'
import type { useBlacklistStore } from '../../../stores/blacklist.store'
import type { useDeviceStore } from '../../../stores/device.store'
import type { useFriendStore } from '../../../stores/friend.store'
import type { useUserStore } from '../../../stores/user.store'
import { normalizeErrorMessage } from '../../../shared/utils/error'

interface UseSettingsActionsOptions {
  userUuid: MaybeRefOrGetter<string>
  session: MaybeRefOrGetter<SessionData | null>
  selectedBlacklistRow: MaybeRefOrGetter<BlacklistRow | null>
  authStore: ReturnType<typeof useAuthStore>
  userStore: ReturnType<typeof useUserStore>
  friendStore: ReturnType<typeof useFriendStore>
  blacklistStore: ReturnType<typeof useBlacklistStore>
  deviceStore: ReturnType<typeof useDeviceStore>
  onSignedOut: () => Promise<void>
}

function getString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key]
  return typeof value === 'string' ? value : ''
}

export function useSettingsActions(options: UseSettingsActionsOptions) {
  const blacklistActionPending = ref(false)
  const blacklistActionError = ref('')
  const deviceActionPendingId = ref('')
  const deviceActionError = ref('')
  const profileSavePending = ref(false)
  const profileSaveError = ref('')
  const avatarUploadPending = ref(false)
  const securityMessage = ref('')
  const securityError = ref('')
  const sendingVerifyCode = ref(false)
  const codeCooldownSeconds = ref(0)
  const changingEmail = ref(false)
  const changingPassword = ref(false)
  const deletingAccount = ref(false)
  let codeCooldownTimer: ReturnType<typeof setInterval> | null = null

  const settingDeviceItems = computed(() =>
    [...options.deviceStore.devices].sort(
      (a, b) => Number(b.isCurrentDevice) - Number(a.isCurrentDevice)
    )
  )

  function clearProfileError(): void {
    profileSaveError.value = ''
  }

  function clearSecurityFeedback(): void {
    securityMessage.value = ''
    securityError.value = ''
  }

  function stopCodeCooldown(): void {
    if (codeCooldownTimer) {
      clearInterval(codeCooldownTimer)
      codeCooldownTimer = null
    }
  }

  function startCodeCooldown(seconds = 60): void {
    stopCodeCooldown()
    codeCooldownSeconds.value = seconds
    codeCooldownTimer = setInterval(() => {
      if (codeCooldownSeconds.value <= 1) {
        stopCodeCooldown()
        codeCooldownSeconds.value = 0
        return
      }
      codeCooldownSeconds.value -= 1
    }, 1000)
  }

  async function handleRemoveBlacklist(): Promise<void> {
    const userUuid = toValue(options.userUuid)
    const selectedBlacklistRow = toValue(options.selectedBlacklistRow)
    if (!userUuid || !selectedBlacklistRow || blacklistActionPending.value) {
      return
    }

    const nickname =
      getString(selectedBlacklistRow.payload, 'nickname') || selectedBlacklistRow.peerUuid
    const confirmed = window.confirm(`确认将「${nickname}」移出黑名单吗？`)
    if (!confirmed) {
      return
    }

    blacklistActionPending.value = true
    blacklistActionError.value = ''
    try {
      await options.blacklistStore.removeFromBlacklist(userUuid, selectedBlacklistRow.peerUuid)
      await options.friendStore.syncFromServer(userUuid)
    } catch (error) {
      blacklistActionError.value = resolveRelationErrorMessage('remove_blacklist', error)
    } finally {
      blacklistActionPending.value = false
    }
  }

  async function handleReloadDevices(): Promise<void> {
    deviceActionError.value = ''
    try {
      await options.deviceStore.loadDevices()
    } catch (error) {
      deviceActionError.value = normalizeErrorMessage(error)
    }
  }

  async function handleProfileSave(payload: UpdateMyProfileRequest): Promise<void> {
    const userUuid = toValue(options.userUuid)
    if (!userUuid || profileSavePending.value) {
      return
    }

    profileSavePending.value = true
    profileSaveError.value = ''
    try {
      await options.userStore.updateProfile(userUuid, payload)
    } catch (error) {
      profileSaveError.value = normalizeErrorMessage(error)
    } finally {
      profileSavePending.value = false
    }
  }

  async function handleProfileAvatarUpload(file: File): Promise<void> {
    const userUuid = toValue(options.userUuid)
    if (!userUuid || avatarUploadPending.value) {
      return
    }

    const normalizedType = file.type.toLowerCase()
    const maxSize = 2 * 1024 * 1024
    if (normalizedType !== 'image/jpeg' && normalizedType !== 'image/png') {
      profileSaveError.value = '头像仅支持 JPG 或 PNG 格式。'
      return
    }
    if (file.size > maxSize) {
      profileSaveError.value = '头像大小不能超过 2MB。'
      return
    }

    avatarUploadPending.value = true
    profileSaveError.value = ''
    try {
      await options.userStore.uploadAvatar(userUuid, file)
    } catch (error) {
      profileSaveError.value = normalizeErrorMessage(error)
    } finally {
      avatarUploadPending.value = false
    }
  }

  async function handleRequestEmailCode(nextEmail: string): Promise<void> {
    if (!nextEmail || sendingVerifyCode.value || codeCooldownSeconds.value > 0) {
      return
    }

    clearSecurityFeedback()
    sendingVerifyCode.value = true
    try {
      const expireSeconds = await options.authStore.requestVerifyCode(nextEmail, 4)
      securityMessage.value = '验证码已发送，请查收新邮箱。'
      startCodeCooldown(expireSeconds || 60)
    } catch (error) {
      if (isSendTooFrequentError(error)) {
        startCodeCooldown(60)
      }
      securityError.value = resolveSecurityErrorMessage('send_email_code', error)
    } finally {
      sendingVerifyCode.value = false
    }
  }

  async function handleSubmitEmail(payload: {
    newEmail: string
    verifyCode: string
  }): Promise<void> {
    const userUuid = toValue(options.userUuid)
    if (!userUuid || changingEmail.value) {
      return
    }

    clearSecurityFeedback()
    changingEmail.value = true
    try {
      const isValid = await options.authStore.verifyEmailCode(
        payload.newEmail,
        payload.verifyCode,
        4
      )
      if (!isValid) {
        securityError.value = '验证码错误，请重新输入。'
        return
      }

      await changeEmail(payload)
      await options.userStore.syncFromServer(userUuid)
      securityMessage.value = '邮箱已更新。'
    } catch (error) {
      securityError.value = resolveSecurityErrorMessage('change_email', error)
    } finally {
      changingEmail.value = false
    }
  }

  async function handleSubmitPassword(payload: {
    oldPassword: string
    newPassword: string
  }): Promise<void> {
    if (changingPassword.value) {
      return
    }

    clearSecurityFeedback()
    changingPassword.value = true
    try {
      await changePassword(payload)
      securityMessage.value = '密码修改成功。'
    } catch (error) {
      securityError.value = resolveSecurityErrorMessage('change_password', error)
    } finally {
      changingPassword.value = false
    }
  }

  async function handleSubmitDelete(payload: { password: string; reason?: string }): Promise<void> {
    if (deletingAccount.value) {
      return
    }

    clearSecurityFeedback()
    deletingAccount.value = true
    try {
      const response = await deleteAccount(payload)
      securityMessage.value = `账号已注销，恢复截止 ${response.data.recoverDeadline || '-'}。正在退出登录...`
      await options.authStore.signOut()
      await options.onSignedOut()
    } catch (error) {
      securityError.value = resolveSecurityErrorMessage('delete_account', error)
    } finally {
      deletingAccount.value = false
    }
  }

  async function handleKickDevice(targetDeviceId: string): Promise<void> {
    if (!targetDeviceId || deviceActionPendingId.value) {
      return
    }

    const session = toValue(options.session)
    if (session?.deviceId === targetDeviceId) {
      deviceActionError.value = '当前设备不允许下线'
      return
    }

    deviceActionPendingId.value = targetDeviceId
    deviceActionError.value = ''
    try {
      await options.deviceStore.kickById(targetDeviceId)
    } catch (error) {
      deviceActionError.value = normalizeErrorMessage(error)
    } finally {
      deviceActionPendingId.value = ''
    }
  }

  async function handleLogout(): Promise<void> {
    await options.authStore.signOut()
    await options.onSignedOut()
  }

  function resetState(): void {
    blacklistActionError.value = ''
    deviceActionError.value = ''
    deviceActionPendingId.value = ''
    profileSaveError.value = ''
    avatarUploadPending.value = false
    clearSecurityFeedback()
    stopCodeCooldown()
    codeCooldownSeconds.value = 0
  }

  function dispose(): void {
    stopCodeCooldown()
  }

  return {
    blacklistActionPending,
    blacklistActionError,
    deviceActionPendingId,
    deviceActionError,
    profileSavePending,
    profileSaveError,
    avatarUploadPending,
    securityMessage,
    securityError,
    sendingVerifyCode,
    codeCooldownSeconds,
    changingEmail,
    changingPassword,
    deletingAccount,
    settingDeviceItems,
    clearProfileError,
    clearSecurityFeedback,
    handleRemoveBlacklist,
    handleReloadDevices,
    handleProfileSave,
    handleProfileAvatarUpload,
    handleRequestEmailCode,
    handleSubmitEmail,
    handleSubmitPassword,
    handleSubmitDelete,
    handleKickDevice,
    handleLogout,
    resetState,
    dispose
  }
}
