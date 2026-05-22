<script setup lang="ts">
import SecurityCenterCard, {
  type ChangeEmailPayload,
  type ChangePasswordPayload,
  type DeleteAccountPayload
} from '../../security/components/SecurityCenterCard.vue'
import type { DeviceRecord } from '../../security/api'
import { formatLastSeenAt } from '../../../shared/utils/presence'
import { useAppStore } from '../../../stores/app.store'
import { Bell, Volume2 } from 'lucide-vue-next'

const appStore = useAppStore()

function triggerTestChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const now = ctx.currentTime
    
    // First tone (higher pitch)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(880, now) // A5
    osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.15)
    
    gain1.gain.setValueAtTime(0.15, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
    
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    
    // Second tone (lower harmony, slightly delayed)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(659.25, now + 0.05) // E5
    osc2.frequency.exponentialRampToValueAtTime(880, now + 0.2)
    
    gain2.gain.setValueAtTime(0.1, now + 0.05)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45)
    
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    
    osc1.start(now)
    osc1.stop(now + 0.4)
    
    osc2.start(now + 0.05)
    osc2.stop(now + 0.45)
  } catch (e) {
    console.warn('Failed to play test sound', e)
  }
}

const props = defineProps<{
  hasSelectedBlacklist: boolean
  selectedBlacklistLabel: string
  blacklistActionPending?: boolean
  blacklistActionError?: string
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

      <!-- Notification & Sound Settings Card -->
      <section class="settings-cell settings-cell--notifications notifications-section">
        <header class="notifications-header">
          <h3>
            <Bell :size="16" class="inline-block mr-2 text-[var(--c-primary)] align-text-bottom" />
            通知与提示音
          </h3>
        </header>

        <div class="notifications-list">
          <div class="setting-item">
            <div class="setting-meta">
              <strong>提示音控制</strong>
              <p>收到新消息、好友申请、入群申请时播放柔和的双音协奏提示音</p>
            </div>
            <label class="switch-container">
              <input
                type="checkbox"
                :checked="appStore.soundEnabled"
                @change="appStore.setSoundEnabled(($event.target as HTMLInputElement).checked)"
              />
              <span class="slider round"></span>
            </label>
          </div>

          <div class="setting-item">
            <div class="setting-meta">
              <strong>通知横幅弹出</strong>
              <p>在界面右上方弹出交互式磨砂气泡提示，方便快速查看与跳转</p>
            </div>
            <label class="switch-container">
              <input
                type="checkbox"
                :checked="appStore.toastEnabled"
                @change="appStore.setToastEnabled(($event.target as HTMLInputElement).checked)"
              />
              <span class="slider round"></span>
            </label>
          </div>

          <div class="setting-item">
            <div class="setting-meta">
              <strong>音效试听与测试</strong>
              <p>即时合成并预览双音阶高保真毛玻璃系统提示音</p>
            </div>
            <button
              type="button"
              class="action-btn action-btn--ghost flex items-center gap-2"
              @click="triggerTestChime"
            >
              <Volume2 :size="14" />
              测试提示音
            </button>
          </div>
        </div>
      </section>

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
.settings-cell--notifications,
.settings-cell--device {
  grid-column: 1 / -1;
}

/* 全局统一样式的卡片表现：利用 var(--bg-panel-solid) 和 var(--shadow-md) */
.blacklist-action-card,
.notifications-section,
.device-section {
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: var(--radius-xl);
  background: var(--c-bg-panel-solid);
  padding: 24px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
}

.blacklist-action-card h3,
.notifications-header h3,
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
  .settings-cell--notifications,
  .settings-cell--device {
    grid-column: auto;
  }
}

/* Notifications settings inner layout */
.notifications-list {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.02);
  border-radius: var(--radius-lg);
  background: var(--c-bg-panel-soft);
  transition: all var(--duration-fast) var(--ease-out);
}

.setting-item:hover {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(0, 198, 112, 0.15);
  transform: translateY(-1px);
}

.setting-meta strong {
  display: block;
  color: var(--c-text-main);
  font-size: 14px;
  font-weight: 700;
  line-height: 1.4;
}

.setting-meta p {
  margin: 4px 0 0;
  color: var(--c-text-sub);
  font-size: 12px;
}

/* Glassmorphic Switches styling */
.switch-container {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 24px;
  flex-shrink: 0;
}

.switch-container input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: .3s;
}

.slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 3px;
  bottom: 3px;
  background-color: rgba(255, 255, 255, 0.8);
  transition: .3s;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

input:checked + .slider {
  background-color: rgba(0, 198, 112, 0.2);
  border-color: rgba(0, 198, 112, 0.4);
}

input:checked + .slider:before {
  transform: translateX(24px);
  background-color: var(--c-primary);
}

.slider.round {
  border-radius: 34px;
}

.slider.round:before {
  border-radius: 50%;
}
</style>
