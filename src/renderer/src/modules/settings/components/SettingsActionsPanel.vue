<script setup lang="ts">
import ProfileEditorCard, {
  type ProfileEditorViewData
} from '../../profile/components/ProfileEditorCard.vue'
import ProfileQRCodeCard from '../../profile/components/ProfileQRCodeCard.vue'
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
  qrCodeUrl: string
  qrCodeToken: string
  qrCodeExpireAt: string
  qrcodeLoading?: boolean
  qrcodeParsing?: boolean
  qrcodeMessage?: string
  qrcodeError?: string
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
  qrcodeClearFeedback: []
  refreshQrCode: []
  parseQrCode: [input: string]
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
    <section v-if="props.hasSelectedBlacklist" class="blacklist-action-card settings-card--full">
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

    <div class="settings-grid">
      <div class="settings-cell settings-cell--profile">
        <ProfileEditorCard
          :profile="props.profile"
          :saving="props.profileSavePending"
          :avatar-uploading="props.profileAvatarUploading"
          :error-message="props.profileSaveError"
          @clear-error="emit('profileClearError')"
          @submit="emit('profileSubmit', $event)"
          @upload-avatar="emit('profileUploadAvatar', $event)"
        />
      </div>

      <div class="settings-cell settings-cell--qrcode">
        <ProfileQRCodeCard
          :qr-code-url="props.qrCodeUrl"
          :qr-code-token="props.qrCodeToken"
          :expire-at="props.qrCodeExpireAt"
          :loading="props.qrcodeLoading"
          :parsing="props.qrcodeParsing"
          :message="props.qrcodeMessage"
          :error-message="props.qrcodeError"
          @clear-feedback="emit('qrcodeClearFeedback')"
          @refresh="emit('refreshQrCode')"
          @parse="emit('parseQrCode', $event)"
        />
      </div>

      <div class="settings-cell settings-cell--security">
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
      </div>

      <section class="device-section settings-cell settings-cell--device">
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
  </div>
</template>

<style scoped>
.settings-actions {
  display: grid;
  gap: 20px;
}

.settings-card--full {
  grid-column: 1 / -1;
}

.settings-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 20px;
}

.settings-cell--security,
.settings-cell--device {
  grid-column: 1 / -1;
}

/* 全局统一样式的卡片表现：利用 var(--bg-panel-solid) 和 var(--shadow-md) */
.blacklist-action-card,
.device-section {
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: var(--radius-xl);
  background: var(--c-bg-panel-solid);
  padding: 24px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
}

.blacklist-action-card h3,
.device-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--c-text-main);
}

.blacklist-action-card p {
  margin: 8px 0 16px;
  color: var(--c-text-sub);
  font-size: 13px;
}

.action-btn {
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.action-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.action-btn--danger {
  color: #fff;
  background: var(--c-danger);
  box-shadow: 0 2px 6px rgba(245, 63, 63, 0.3);
}

.action-btn--danger:hover:not(:disabled) {
  background: #d43b3b;
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(245, 63, 63, 0.4);
}

.action-btn--ghost {
  color: var(--c-text-sub);
  background: #fff;
  border-color: var(--c-border);
}

.action-btn--ghost:hover:not(:disabled) {
  border-color: var(--c-text-main);
  color: var(--c-text-main);
  transform: translateY(-1px);
}

.apply-error {
  margin: 12px 0 0;
  color: var(--c-danger);
  font-size: 13px;
  font-weight: 500;
}

.device-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.device-list {
  display: grid;
  gap: 12px;
}

.device-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
  border: 1px solid rgba(0, 0, 0, 0.04);
  border-radius: var(--radius-lg);
  background: var(--c-bg-panel-soft);
  transition: all var(--duration-fast) var(--ease-out);
}

.device-item:hover {
  background: #fff;
  border-color: var(--c-primary-soft);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.device-meta strong {
  display: block;
  color: var(--c-text-main);
  font-size: 14px;
  font-weight: 700;
  line-height: 1.4;
}

.device-meta p {
  margin: 4px 0 0;
  color: var(--c-text-sub);
  font-size: 13px;
}

.device-meta small {
  display: inline-block;
  margin-top: 6px;
  color: var(--c-text-muted);
  font-size: 11px;
  background: rgba(0, 0, 0, 0.04);
  padding: 2px 8px;
  border-radius: var(--radius-full);
}

.device-actions {
  flex-shrink: 0;
}

.device-current {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  border-radius: var(--radius-full);
  background: rgba(0, 198, 112, 0.1);
  color: var(--c-primary);
  font-size: 12px;
  font-weight: 700;
}

.device-empty {
  margin: 0;
  padding: 24px 0;
  text-align: center;
  color: var(--c-text-muted);
  font-size: 13px;
}

@media (max-width: 1399px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }

  .settings-cell--security,
  .settings-cell--device {
    grid-column: auto;
  }
}
</style>
