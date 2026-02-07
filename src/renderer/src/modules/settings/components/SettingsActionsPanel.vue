<script setup lang="ts">
import ProfileEditorCard, {
  type ProfileEditorViewData
} from '../../profile/components/ProfileEditorCard.vue'
import SecurityCenterCard, {
  type ChangeEmailPayload,
  type ChangePasswordPayload,
  type DeleteAccountPayload
} from '../../security/components/SecurityCenterCard.vue'
import type { DeviceRecord } from '../../security/api'
import { formatLastSeenAt } from '../../../shared/utils/presence'

const props = defineProps<{
  hasSelectedBlacklist: boolean
  selectedBlacklistLabel: string
  blacklistActionPending?: boolean
  blacklistActionError?: string
  profile: ProfileEditorViewData | null
  profileSavePending?: boolean
  profileAvatarUploading?: boolean
  profileSaveError?: string
  currentEmail: string
  sendingVerifyCode?: boolean
  codeCooldownSeconds?: number
  changingEmail?: boolean
  changingPassword?: boolean
  deletingAccount?: boolean
  securityMessage?: string
  securityError?: string
  deviceLoading?: boolean
  deviceItems: DeviceRecord[]
  currentDeviceId: string
  deviceActionPendingId?: string
  deviceActionError?: string
}>()

const emit = defineEmits<{
  removeBlacklist: []
  profileSubmit: [
    payload: { nickname?: string; gender?: number; birthday?: string; signature?: string }
  ]
  profileUploadAvatar: [file: File]
  profileClearError: []
  securityClearFeedback: []
  requestEmailCode: [email: string]
  submitEmail: [payload: ChangeEmailPayload]
  submitPassword: [payload: ChangePasswordPayload]
  submitDelete: [payload: DeleteAccountPayload]
  reloadDevices: []
  kickDevice: [deviceId: string]
}>()

function getDeviceStatusLabel(status: number): string {
  if (status === 0) {
    return '在线'
  }
  if (status === 1) {
    return '离线'
  }
  if (status === 2) {
    return '已注销'
  }
  if (status === 3) {
    return '已被下线'
  }
  return `未知(${status})`
}

function getLastSeenText(value: string): string {
  return formatLastSeenAt(value) || '-'
}
</script>

<template>
  <div class="settings-actions">
    <section v-if="props.hasSelectedBlacklist" class="blacklist-action-card">
      <h3>黑名单操作</h3>
      <p>当前选中用户：{{ props.selectedBlacklistLabel }}</p>
      <button
        type="button"
        class="action-btn action-btn--ghost"
        :disabled="props.blacklistActionPending"
        @click="emit('removeBlacklist')"
      >
        移出黑名单
      </button>
      <p v-if="props.blacklistActionError" class="apply-error">{{ props.blacklistActionError }}</p>
    </section>

    <ProfileEditorCard
      :profile="props.profile"
      :saving="props.profileSavePending"
      :avatar-uploading="props.profileAvatarUploading"
      :error-message="props.profileSaveError"
      @clear-error="emit('profileClearError')"
      @submit="emit('profileSubmit', $event)"
      @upload-avatar="emit('profileUploadAvatar', $event)"
    />

    <SecurityCenterCard
      :current-email="props.currentEmail"
      :sending-code="props.sendingVerifyCode"
      :code-cooldown-seconds="props.codeCooldownSeconds"
      :saving-email="props.changingEmail"
      :saving-password="props.changingPassword"
      :deleting-account="props.deletingAccount"
      :message="props.securityMessage"
      :error-message="props.securityError"
      @clear-feedback="emit('securityClearFeedback')"
      @request-email-code="emit('requestEmailCode', $event)"
      @submit-email="emit('submitEmail', $event)"
      @submit-password="emit('submitPassword', $event)"
      @submit-delete="emit('submitDelete', $event)"
    />

    <section class="device-section">
      <header class="device-header">
        <h3>设备管理</h3>
        <button
          type="button"
          class="action-btn action-btn--ghost"
          :disabled="props.deviceLoading || !!props.deviceActionPendingId"
          @click="emit('reloadDevices')"
        >
          刷新
        </button>
      </header>

      <p v-if="props.deviceLoading" class="device-empty">正在拉取设备列表...</p>
      <ul v-else-if="props.deviceItems.length > 0" class="device-list">
        <li v-for="item in props.deviceItems" :key="item.deviceId" class="device-item">
          <div class="device-meta">
            <strong>{{ item.deviceName || item.deviceId }}</strong>
            <p>{{ item.platform || '-' }} · {{ item.appVersion || '-' }}</p>
            <small
              >{{ getDeviceStatusLabel(item.status) }} · 最近活跃
              {{ getLastSeenText(item.lastSeenAt) }}</small
            >
          </div>
          <div class="device-actions">
            <span v-if="item.deviceId === props.currentDeviceId" class="device-current"
              >当前设备</span
            >
            <button
              v-else
              type="button"
              class="action-btn action-btn--danger"
              :disabled="props.deviceActionPendingId === item.deviceId"
              @click="emit('kickDevice', item.deviceId)"
            >
              下线
            </button>
          </div>
        </li>
      </ul>
      <p v-else class="device-empty">暂无设备记录</p>

      <p v-if="props.deviceActionError" class="apply-error">{{ props.deviceActionError }}</p>
    </section>
  </div>
</template>

<style scoped>
.settings-actions {
  display: grid;
  gap: 12px;
}

.blacklist-action-card {
  border: 1px solid var(--c-border);
  border-radius: 14px;
  background: #fff;
  padding: 14px;
  box-shadow: var(--shadow-1);
}

.blacklist-action-card h3 {
  margin: 0;
  font-size: 14px;
  color: var(--c-text-main);
}

.blacklist-action-card p {
  margin: 8px 0;
  color: var(--c-text-sub);
  font-size: 12px;
}

.action-btn {
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 7px 14px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease-out;
}

.action-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.action-btn--danger {
  color: #fff;
  background: var(--c-danger);
}

.action-btn--danger:hover:not(:disabled) {
  opacity: 0.9;
}

.action-btn--ghost {
  color: var(--c-text-sub);
  background: #fff;
  border-color: var(--c-border);
}

.action-btn--ghost:hover:not(:disabled) {
  border-color: #c7ced7;
}

.apply-error {
  margin: 8px 0 0;
  color: var(--c-danger);
  font-size: 12px;
}

.device-section {
  border: 1px solid var(--c-border);
  border-radius: 14px;
  background: #fff;
  padding: 14px;
  box-shadow: var(--shadow-1);
}

.device-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.device-header h3 {
  margin: 0;
  font-size: 14px;
  color: var(--c-text-main);
}

.device-list {
  display: grid;
  gap: 8px;
}

.device-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--c-border);
  border-radius: 10px;
  background: #fafbfc;
}

.device-meta strong {
  display: block;
  color: var(--c-text-main);
  font-size: 13px;
  line-height: 1.4;
}

.device-meta p {
  margin: 4px 0 0;
  color: var(--c-text-sub);
  font-size: 12px;
}

.device-meta small {
  display: block;
  margin-top: 2px;
  color: var(--c-text-muted);
  font-size: 11px;
}

.device-actions {
  flex-shrink: 0;
}

.device-current {
  display: inline-grid;
  place-items: center;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(7, 193, 96, 0.14);
  color: var(--c-primary);
  font-size: 11px;
  font-weight: 600;
}

.device-empty {
  margin: 0;
  color: var(--c-text-muted);
  font-size: 12px;
}
</style>
