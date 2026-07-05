<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '../../../stores/auth.store'
import { useDeviceStore } from '../../../stores/device.store'
import { useUserStore } from '../../../stores/user.store'
import { useFriendStore } from '../../../stores/friend.store'
import { useBlacklistStore } from '../../../stores/blacklist.store'
import { useConnStore } from '../../../stores/conn.store'
import { useRouter } from 'vue-router'
import { useSettingsActions } from '../../chat/composables/useSettingsActions'
import SettingsActionsPanel from '../components/SettingsActionsPanel.vue'
import { toast } from 'vue-sonner'
import { resetAuthenticatedState } from '../../../stores/authenticated-state'

const router = useRouter()
const authStore = useAuthStore()
const deviceStore = useDeviceStore()
const userStore = useUserStore()
const friendStore = useFriendStore()
const blacklistStore = useBlacklistStore()
const connStore = useConnStore()

const { userUuid, session } = storeToRefs(authStore)
const { loading: deviceLoading } = storeToRefs(deviceStore)

// SettingsView does not currently handle blacklist selection explicitly within the UI,
// but to satisfy useSettingsActions we provide a dummy ref. In the future this can be expanded.
const selectedBlacklistRow = ref(null)

const {
  deviceActionPendingId,
  deviceActionError,
  securityMessage,
  securityError,
  sendingVerifyCode,
  codeCooldownSeconds,
  changingEmail,
  changingPassword,
  deletingAccount,
  settingDeviceItems,
  clearSecurityFeedback,
  handleReloadDevices,
  handleRequestEmailCode,
  handleSubmitEmail,
  handleSubmitPassword,
  handleSubmitDelete,
  handleKickDevice,
  dispose
} = useSettingsActions({
  userUuid,
  session,
  selectedBlacklistRow,
  authStore,
  userStore,
  friendStore,
  blacklistStore,
  deviceStore,
  onSignedOut: async () => {
    connStore.disconnect()
    await resetAuthenticatedState()
    await router.replace('/login')
  }
})

// Setup premium toast feedback triggers
watch(securityMessage, (newVal) => {
  if (newVal) {
    toast.success(newVal)
    clearSecurityFeedback()
  }
})

watch(securityError, (newVal) => {
  if (newVal) {
    toast.error(newVal)
    clearSecurityFeedback()
  }
})

watch(deviceActionError, (newVal) => {
  if (newVal) {
    toast.error(newVal)
    deviceActionError.value = ''
  }
})

const currentEmail = ''

onBeforeUnmount(() => {
  dispose()
})
</script>

<template>
  <main class="flex-1 h-full min-h-0 overflow-hidden flex flex-col bg-[var(--c-bg-panel-soft)]">
    <header class="px-8 py-6 border-b border-[var(--c-border)] bg-[var(--c-bg-panel)] sticky top-0 z-10 backdrop-blur-xl">
      <h2 class="text-xl font-bold text-[var(--c-text-main)] drop-shadow-sm">个人设置与安全</h2>
    </header>
    <div class="flex-1 min-h-0 p-8 overflow-y-auto">
      <div class="max-w-4xl mx-auto">
        <SettingsActionsPanel
          :has-selected-blacklist="false"
          selected-blacklist-label=""
          :current-email="currentEmail"
          :sending-verify-code="sendingVerifyCode"
          :code-cooldown-seconds="codeCooldownSeconds"
          :changing-email="changingEmail"
          :changing-password="changingPassword"
          :deleting-account="deletingAccount"
          :security-message="securityMessage"
          :security-error="securityError"
          :device-loading="deviceLoading"
          :device-items="settingDeviceItems"
          :current-device-id="session?.deviceId || ''"
          :device-action-pending-id="deviceActionPendingId"
          :device-action-error="deviceActionError"
          @security-clear-feedback="clearSecurityFeedback"
          @request-email-code="handleRequestEmailCode"
          @submit-email="handleSubmitEmail"
          @submit-password="handleSubmitPassword"
          @submit-delete="handleSubmitDelete"
          @reload-devices="handleReloadDevices"
          @kick-device="handleKickDevice"
        />
      </div>
    </div>
  </main>
</template>
