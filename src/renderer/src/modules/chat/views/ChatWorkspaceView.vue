<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import ConversationPane from '../components/ConversationPane.vue'
import MessagePane from '../components/MessagePane.vue'
import SidebarNav from '../components/SidebarNav.vue'
import DetailPane from '../../contact/components/DetailPane.vue'
import ListPane from '../../contact/components/ListPane.vue'
import ProfileEditorCard from '../../profile/components/ProfileEditorCard.vue'
import { useAppStore, type MainNavKey } from '../../../stores/app.store'
import { useApplyStore } from '../../../stores/apply.store'
import { useAuthStore } from '../../../stores/auth.store'
import { useBlacklistStore } from '../../../stores/blacklist.store'
import { useDeviceStore } from '../../../stores/device.store'
import { useFriendStore } from '../../../stores/friend.store'
import { useSessionStore } from '../../../stores/session.store'
import { useUserStore } from '../../../stores/user.store'
import { normalizeErrorMessage } from '../../../shared/utils/error'
import { formatConversationTime } from '../../../shared/utils/time'
import type { UpdateMyProfileRequest } from '../../../shared/types/user'

interface ConversationListItem {
  convId: string
  title: string
  preview: string
  unread: number
  timeText: string
}

interface PaneItem {
  id: string
  title: string
  subtitle: string
  meta?: string
  badge?: number
}

interface ProfileEditorData {
  uuid: string
  email: string
  telephone: string
  nickname: string
  gender: number
  birthday: string
  signature: string
}

const router = useRouter()
const appStore = useAppStore()
const applyStore = useApplyStore()
const authStore = useAuthStore()
const blacklistStore = useBlacklistStore()
const deviceStore = useDeviceStore()
const friendStore = useFriendStore()
const sessionStore = useSessionStore()
const userStore = useUserStore()

const selectedFriendId = ref('')
const selectedApplyId = ref('')
const selectedBlacklistId = ref('')
const applyActionPending = ref(false)
const applyActionError = ref('')
const deviceActionPendingId = ref('')
const deviceActionError = ref('')
const profileSavePending = ref(false)
const profileSaveError = ref('')

const { activeNav } = storeToRefs(appStore)
const { userUuid, session } = storeToRefs(authStore)
const { profile } = storeToRefs(userStore)
const { friends } = storeToRefs(friendStore)
const { items: blacklistItems } = storeToRefs(blacklistStore)
const { devices, loading: deviceLoading } = storeToRefs(deviceStore)
const { inbox: applyInbox } = storeToRefs(applyStore)
const {
  conversations,
  activeConvId,
  activeConversation,
  activeMessages,
  activeDraft,
  loading,
  localDBAvailable
} = storeToRefs(sessionStore)

function getString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key]
  return typeof value === 'string' ? value : ''
}

function getNumber(payload: Record<string, unknown>, key: string): number {
  const value = payload[key]
  return typeof value === 'number' ? value : 0
}

function getBoolean(payload: Record<string, unknown>, key: string): boolean {
  const value = payload[key]
  return value === true || value === 1
}

function getApplyStatusLabel(status: number): string {
  if (status === 0) {
    return '待处理'
  }
  if (status === 1) {
    return '已同意'
  }
  if (status === 2) {
    return '已拒绝'
  }
  return `未知(${status})`
}

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

function formatDateTime(timestamp: number): string {
  if (!timestamp) {
    return '-'
  }
  return new Date(timestamp).toLocaleString('zh-CN')
}

const userLabel = computed(() => {
  const nickname = profile.value ? getString(profile.value.payload, 'nickname') : ''
  return nickname || userUuid.value || '匿名用户'
})

const unreadApplyCount = computed(() =>
  applyInbox.value.reduce((count, row) => count + (getBoolean(row.payload, 'isRead') ? 0 : 1), 0)
)

const activeConversationTitle = computed(() => {
  if (!activeConversation.value) {
    return '会话'
  }
  return sessionStore.getConversationTitle(activeConversation.value)
})

const conversationItems = computed<ConversationListItem[]>(() =>
  conversations.value.map((item) => ({
    convId: item.convId,
    title: sessionStore.getConversationTitle(item),
    preview: sessionStore.getConversationPreview(item),
    unread: sessionStore.getConversationUnread(item),
    timeText: formatConversationTime(item.updatedAt)
  }))
)

const friendPaneItems = computed<PaneItem[]>(() =>
  friends.value.map((row) => ({
    id: row.peerUuid,
    title: getString(row.payload, 'remark') || getString(row.payload, 'nickname') || row.peerUuid,
    subtitle: getString(row.payload, 'signature') || '暂无签名',
    meta: getString(row.payload, 'groupTag') || '未分组'
  }))
)

const applyPaneItems = computed<PaneItem[]>(() =>
  applyInbox.value.map((row) => ({
    id: String(row.applyId),
    title: getString(row.payload, 'applicantNickname') || getString(row.payload, 'applicantUuid'),
    subtitle: getString(row.payload, 'reason') || '无申请附言',
    meta: formatDateTime(getNumber(row.payload, 'createdAt')),
    badge: getBoolean(row.payload, 'isRead') ? 0 : 1
  }))
)

const blacklistPaneItems = computed<PaneItem[]>(() =>
  blacklistItems.value.map((row) => ({
    id: row.peerUuid,
    title: getString(row.payload, 'nickname') || row.peerUuid,
    subtitle: row.peerUuid,
    meta: formatDateTime(getNumber(row.payload, 'blacklistedAt'))
  }))
)

watch(
  friendPaneItems,
  (items) => {
    if (items.length === 0) {
      selectedFriendId.value = ''
      return
    }
    if (!items.some((item) => item.id === selectedFriendId.value)) {
      const first = items[0]
      selectedFriendId.value = first ? first.id : ''
    }
  },
  { immediate: true }
)

watch(
  applyPaneItems,
  (items) => {
    if (items.length === 0) {
      selectedApplyId.value = ''
      return
    }
    if (!items.some((item) => item.id === selectedApplyId.value)) {
      const first = items[0]
      selectedApplyId.value = first ? first.id : ''
    }
  },
  { immediate: true }
)

watch(
  blacklistPaneItems,
  (items) => {
    if (items.length === 0) {
      selectedBlacklistId.value = ''
      return
    }
    if (!items.some((item) => item.id === selectedBlacklistId.value)) {
      const first = items[0]
      selectedBlacklistId.value = first ? first.id : ''
    }
  },
  { immediate: true }
)

const selectedFriendRow = computed(
  () => friends.value.find((item) => item.peerUuid === selectedFriendId.value) ?? null
)
const selectedApplyRow = computed(
  () => applyInbox.value.find((item) => String(item.applyId) === selectedApplyId.value) ?? null
)
const selectedBlacklistRow = computed(
  () => blacklistItems.value.find((item) => item.peerUuid === selectedBlacklistId.value) ?? null
)
const selectedApplyIsPending = computed(() => selectedApplyRow.value?.status === 0)
const selectedApplyIsRead = computed(() =>
  selectedApplyRow.value ? getBoolean(selectedApplyRow.value.payload, 'isRead') : true
)

const contactDetailLines = computed(() => {
  if (!selectedFriendRow.value) {
    return []
  }

  const payload = selectedFriendRow.value.payload
  return [
    { label: '好友 UUID', value: selectedFriendRow.value.peerUuid },
    { label: '昵称', value: getString(payload, 'nickname') || '-' },
    { label: '备注', value: getString(payload, 'remark') || '-' },
    { label: '标签', value: getString(payload, 'groupTag') || '-' },
    { label: '来源', value: getString(payload, 'source') || '-' },
    { label: '签名', value: getString(payload, 'signature') || '-' },
    { label: '添加时间', value: formatDateTime(getNumber(payload, 'createdAt')) }
  ]
})

const applyDetailLines = computed(() => {
  if (!selectedApplyRow.value) {
    return []
  }

  const payload = selectedApplyRow.value.payload
  return [
    { label: '申请 ID', value: String(selectedApplyRow.value.applyId) },
    { label: '申请人 UUID', value: getString(payload, 'applicantUuid') || '-' },
    { label: '申请人昵称', value: getString(payload, 'applicantNickname') || '-' },
    { label: '来源', value: getString(payload, 'source') || '-' },
    { label: '状态', value: getApplyStatusLabel(selectedApplyRow.value.status) },
    { label: '已读', value: getBoolean(payload, 'isRead') ? '是' : '否' },
    { label: '申请时间', value: formatDateTime(getNumber(payload, 'createdAt')) },
    { label: '附言', value: getString(payload, 'reason') || '-' }
  ]
})

const settingsDetailTitle = computed(() => (selectedBlacklistRow.value ? '黑名单详情' : '账户信息'))
const settingsDetailLines = computed(() => {
  if (selectedBlacklistRow.value) {
    const payload = selectedBlacklistRow.value.payload
    return [
      { label: '用户 UUID', value: selectedBlacklistRow.value.peerUuid },
      { label: '昵称', value: getString(payload, 'nickname') || '-' },
      { label: '拉黑时间', value: formatDateTime(getNumber(payload, 'blacklistedAt')) }
    ]
  }

  if (!profile.value) {
    return []
  }

  const payload = profile.value.payload
  return [
    { label: '用户 UUID', value: getString(payload, 'uuid') || userUuid.value },
    { label: '昵称', value: getString(payload, 'nickname') || '-' },
    { label: '邮箱', value: getString(payload, 'email') || '-' },
    { label: '手机号', value: getString(payload, 'telephone') || '-' },
    { label: '签名', value: getString(payload, 'signature') || '-' }
  ]
})

const profileEditorData = computed<ProfileEditorData | null>(() => {
  if (!profile.value) {
    return null
  }

  const payload = profile.value.payload
  const gender = getNumber(payload, 'gender')

  return {
    uuid: getString(payload, 'uuid') || userUuid.value,
    email: getString(payload, 'email'),
    telephone: getString(payload, 'telephone'),
    nickname: getString(payload, 'nickname'),
    gender: gender === 1 || gender === 2 || gender === 3 ? gender : 3,
    birthday: getString(payload, 'birthday'),
    signature: getString(payload, 'signature')
  }
})
const settingDeviceItems = computed(() =>
  [...devices.value].sort((a, b) => Number(b.isCurrentDevice) - Number(a.isCurrentDevice))
)

async function handleNavChange(nextNav: MainNavKey): Promise<void> {
  appStore.setActiveNav(nextNav)
}

async function handleConversationSelect(convId: string): Promise<void> {
  await sessionStore.openConversation(convId)
}

function handleFriendSelect(id: string): void {
  selectedFriendId.value = id
}

function handleApplySelect(id: string): void {
  applyActionError.value = ''
  selectedApplyId.value = id
}

function handleBlacklistSelect(id: string): void {
  selectedBlacklistId.value = id
}

function handleProfileInput(): void {
  profileSaveError.value = ''
}

async function handleDraftChange(value: string): Promise<void> {
  await sessionStore.setDraft(value)
}

async function handleSend(text: string): Promise<void> {
  await sessionStore.sendMessage(text)
}

async function handleApplyMarkRead(): Promise<void> {
  if (
    !userUuid.value ||
    !selectedApplyRow.value ||
    selectedApplyIsRead.value ||
    applyActionPending.value
  ) {
    return
  }

  applyActionPending.value = true
  applyActionError.value = ''
  try {
    await applyStore.markAsRead(userUuid.value, [selectedApplyRow.value.applyId])
  } catch (error) {
    applyActionError.value = normalizeErrorMessage(error)
  } finally {
    applyActionPending.value = false
  }
}

async function handleApplyAction(action: 1 | 2): Promise<void> {
  if (!userUuid.value || !selectedApplyRow.value || applyActionPending.value) {
    return
  }

  applyActionPending.value = true
  applyActionError.value = ''
  try {
    await applyStore.handleApplyAction(userUuid.value, selectedApplyRow.value.applyId, action)
    if (action === 1) {
      await friendStore.syncFromServer(userUuid.value)
    }
  } catch (error) {
    applyActionError.value = normalizeErrorMessage(error)
  } finally {
    applyActionPending.value = false
  }
}

async function handleReloadDevices(): Promise<void> {
  deviceActionError.value = ''
  try {
    await deviceStore.loadDevices()
  } catch (error) {
    deviceActionError.value = normalizeErrorMessage(error)
  }
}

async function handleProfileSave(payload: UpdateMyProfileRequest): Promise<void> {
  if (!userUuid.value || profileSavePending.value) {
    return
  }

  profileSavePending.value = true
  profileSaveError.value = ''
  try {
    await userStore.updateProfile(userUuid.value, payload)
  } catch (error) {
    profileSaveError.value = normalizeErrorMessage(error)
  } finally {
    profileSavePending.value = false
  }
}

async function handleKickDevice(targetDeviceId: string): Promise<void> {
  if (!targetDeviceId || deviceActionPendingId.value) {
    return
  }

  if (session.value?.deviceId === targetDeviceId) {
    deviceActionError.value = '当前设备不允许下线'
    return
  }

  deviceActionPendingId.value = targetDeviceId
  deviceActionError.value = ''
  try {
    await deviceStore.kickById(targetDeviceId)
  } catch (error) {
    deviceActionError.value = normalizeErrorMessage(error)
  } finally {
    deviceActionPendingId.value = ''
  }
}

async function handleLogout(): Promise<void> {
  await authStore.signOut()
  userStore.reset()
  friendStore.reset()
  applyStore.reset()
  blacklistStore.reset()
  deviceStore.reset()
  await sessionStore.clearState()
  appStore.setActiveNav('chat')
  await router.replace({ name: 'login' })
}

onMounted(async () => {
  await authStore.hydrateSession()
  if (!authStore.isAuthenticated) {
    await router.replace({ name: 'login' })
    return
  }

  await Promise.all([
    userStore.loadProfile(authStore.userUuid),
    sessionStore.bootstrap(authStore.userUuid),
    friendStore.loadFriends(authStore.userUuid),
    blacklistStore.load(authStore.userUuid),
    applyStore.loadInbox(authStore.userUuid)
  ])

  await Promise.all([
    userStore.syncFromServer(authStore.userUuid),
    friendStore.syncFromServer(authStore.userUuid),
    blacklistStore.syncFromServer(authStore.userUuid),
    applyStore.syncInboxFromServer(authStore.userUuid),
    deviceStore.loadDevices().catch((error) => {
      console.warn('sync devices from server failed, keep current state', error)
    })
  ])
})
</script>

<template>
  <div class="workspace">
    <p v-if="!localDBAvailable" class="degrade-banner">本地缓存不可用，已自动降级为内存模式。</p>
    <SidebarNav
      :active-nav="activeNav"
      :user-label="userLabel"
      :discover-badge="unreadApplyCount"
      @select="handleNavChange"
      @logout="handleLogout"
    />

    <template v-if="activeNav === 'chat'">
      <ConversationPane
        :items="conversationItems"
        :active-conv-id="activeConvId"
        :loading="loading"
        @select="handleConversationSelect"
      />
      <MessagePane
        :title="activeConversationTitle"
        :messages="activeMessages"
        :draft="activeDraft"
        @update:draft="handleDraftChange"
        @send="handleSend"
      />
    </template>

    <template v-else-if="activeNav === 'contacts'">
      <ListPane
        title="通讯录"
        :items="friendPaneItems"
        :selected-id="selectedFriendId"
        :loading="false"
        empty-text="暂无好友"
        @select="handleFriendSelect"
      />
      <DetailPane
        title="联系人详情"
        description="好友信息来自本地缓存，在线同步后自动更新。"
        :lines="contactDetailLines"
        empty-text="请选择一位好友查看详情"
      />
    </template>

    <template v-else-if="activeNav === 'discover'">
      <ListPane
        title="好友申请"
        :items="applyPaneItems"
        :selected-id="selectedApplyId"
        :loading="false"
        empty-text="暂无好友申请"
        @select="handleApplySelect"
      />
      <DetailPane
        title="申请详情"
        description="申请状态与已读状态以服务端返回为准。"
        :lines="applyDetailLines"
        empty-text="请选择一条申请查看详情"
      >
        <template #actions>
          <div v-if="selectedApplyRow" class="apply-actions">
            <button
              type="button"
              class="action-btn action-btn--primary"
              :disabled="!selectedApplyIsPending || applyActionPending"
              @click="handleApplyAction(1)"
            >
              同意
            </button>
            <button
              type="button"
              class="action-btn action-btn--danger"
              :disabled="!selectedApplyIsPending || applyActionPending"
              @click="handleApplyAction(2)"
            >
              拒绝
            </button>
            <button
              type="button"
              class="action-btn action-btn--ghost"
              :disabled="selectedApplyIsRead || applyActionPending"
              @click="handleApplyMarkRead"
            >
              标记已读
            </button>
          </div>
          <p v-if="applyActionError" class="apply-error">{{ applyActionError }}</p>
        </template>
      </DetailPane>
    </template>

    <template v-else>
      <ListPane
        title="黑名单"
        :items="blacklistPaneItems"
        :selected-id="selectedBlacklistId"
        :loading="false"
        empty-text="黑名单为空"
        @select="handleBlacklistSelect"
      />
      <DetailPane
        :title="settingsDetailTitle"
        description="账户信息与隐私设置将在后续版本扩展。"
        :lines="settingsDetailLines"
        empty-text="暂无可展示信息"
      >
        <template #actions>
          <div class="settings-actions">
            <ProfileEditorCard
              :profile="profileEditorData"
              :saving="profileSavePending"
              :error-message="profileSaveError"
              @clear-error="handleProfileInput"
              @submit="handleProfileSave"
            />

            <section class="device-section">
              <header class="device-header">
                <h3>设备管理</h3>
                <button
                  type="button"
                  class="action-btn action-btn--ghost"
                  :disabled="deviceLoading || !!deviceActionPendingId"
                  @click="handleReloadDevices"
                >
                  刷新
                </button>
              </header>

              <p v-if="deviceLoading" class="device-empty">正在拉取设备列表...</p>
              <ul v-else-if="settingDeviceItems.length > 0" class="device-list">
                <li v-for="item in settingDeviceItems" :key="item.deviceId" class="device-item">
                  <div class="device-meta">
                    <strong>{{ item.deviceName || item.deviceId }}</strong>
                    <p>{{ item.platform || '-' }} · {{ item.appVersion || '-' }}</p>
                    <small>
                      {{ getDeviceStatusLabel(item.status) }} · 最近活跃
                      {{ item.lastSeenAt || '-' }}
                    </small>
                  </div>
                  <div class="device-actions">
                    <span v-if="item.isCurrentDevice" class="device-current">当前设备</span>
                    <button
                      v-else
                      type="button"
                      class="action-btn action-btn--danger"
                      :disabled="deviceActionPendingId === item.deviceId"
                      @click="handleKickDevice(item.deviceId)"
                    >
                      下线
                    </button>
                  </div>
                </li>
              </ul>
              <p v-else class="device-empty">暂无设备记录</p>

              <p v-if="deviceActionError" class="apply-error">{{ deviceActionError }}</p>
            </section>
          </div>
        </template>
      </DetailPane>
    </template>
  </div>
</template>

<style scoped>
.workspace {
  position: relative;
  width: 100%;
  height: 100vh;
  min-height: 760px;
  min-width: 1200px;
  display: flex;
}

.degrade-banner {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
  z-index: 10;
  background: rgba(255, 125, 0, 0.16);
  border: 1px solid rgba(255, 125, 0, 0.35);
  color: #7b4a00;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
}

@media (max-width: 1199px) {
  .workspace {
    min-width: 1024px;
  }
}

.apply-actions {
  display: flex;
  align-items: center;
  gap: 8px;
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

.action-btn--primary {
  color: #fff;
  background: var(--c-primary);
}

.action-btn--primary:hover:not(:disabled) {
  background: var(--c-primary-hover);
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

.settings-actions {
  display: grid;
  gap: 12px;
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
