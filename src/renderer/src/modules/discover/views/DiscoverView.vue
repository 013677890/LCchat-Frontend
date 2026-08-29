<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { searchUsers, sendFriendApply, fetchOtherProfile } from '../../contact/api'
import { searchGroups as apiSearchGroups } from '../../group/api'
import { useAuthStore } from '../../../stores/auth.store'
import { useFriendStore } from '../../../stores/friend.store'
import { useApplyStore } from '../../../stores/apply.store'
import { useGroupStore } from '../../../stores/group.store'
import { useSessionStore } from '../../../stores/session.store'
import { useUserStore } from '../../../stores/user.store'
import { usePresenceStore } from '../../../stores/presence.store'
import { useBlacklistStore } from '../../../stores/blacklist.store'
import { normalizeErrorMessage } from '../../../shared/utils/error'
import { resolveRelationErrorMessage } from '../../contact/error-message'
import { resolveAssetUrl } from '../../../shared/utils/asset-url'
import { buildQRCodeDataUrl } from '../../../shared/utils/qr-renderer'
import { avatarInitial, avatarPaletteFromId } from '../../../shared/utils/avatar'
import { openChatConversation } from '../navigation'
import { writeTextToClipboard } from '../../../shared/utils/clipboard'
import { toast } from 'vue-sonner'
import {
  Search,
  UserPlus,
  Users,
  QrCode,
  RefreshCw,
  Copy,
  Download,
  Check,
  Sparkles,
  ExternalLink,
  MessageSquare,
  Smile,
  Info,
  ChevronRight,
  Send,
  AlertCircle,
  X,
  UserCheck,
  ArrowRight
} from 'lucide-vue-next'
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogClose
} from 'radix-vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const friendStore = useFriendStore()
const applyStore = useApplyStore()
const groupStore = useGroupStore()
const sessionStore = useSessionStore()
const userStore = useUserStore()
const presenceStore = usePresenceStore()
const blacklistStore = useBlacklistStore()

const { userUuid } = storeToRefs(authStore)
const { profile, qrCode } = storeToRefs(userStore)

// Active Tab: 'user' | 'group' | 'scan'
const activeTab = ref<'user' | 'group' | 'scan'>('user')

// Search & Input States
const searchKeyword = ref('')
const searching = ref(false)
const searchResultsUsers = ref<any[]>([])
const searchResultsGroups = ref<any[]>([])

// QR Parse Tab States
const qrInput = ref('')
const parsingQr = ref(false)
const parsedUser = ref<any>(null)

// Apply Modal State
const isApplyModalOpen = ref(false)
const applyModalType = ref<'user' | 'group'>('user')
const applyModalTargetUuid = ref('')
const applyModalTargetName = ref('')
const applyModalReason = ref('我是 LCChat 用户')
const applySubmitting = ref(false)

// Quick preset phrases for the apply modal
const quickPhrases = [
  '你好，交个朋友吧！',
  '我是群友，加个好友。',
  '大佬好，求带！',
  '一起交流技术与生活。'
]

// Personal QR Code properties
const exportPending = ref(false)
const localCopyFeedback = ref('')

const qrImageUrl = computed(() => {
  if (!qrCode.value?.qrCode) return ''
  try {
    return buildQRCodeDataUrl(qrCode.value.qrCode, {
      size: 260,
      margin: 3,
      dark: '#111111',
      light: '#ffffff'
    })
  } catch {
    return ''
  }
})

const qrExpireText = computed(() => {
  if (!qrCode.value?.expireAt) return '-'
  const date = new Date(qrCode.value.expireAt)
  return Number.isNaN(date.getTime()) ? qrCode.value.expireAt : date.toLocaleString('zh-CN')
})

// Check statuses
function isFriend(uuid: string): boolean {
  return friendStore.friends.some((f) => f.peerUuid === uuid)
}

function isSelf(uuid: string): boolean {
  return uuid === userUuid.value
}

function isBlacklisted(uuid: string): boolean {
  return blacklistStore.items.some((b) => b.peerUuid === uuid)
}

function isGroupJoined(groupUuid: string): boolean {
  return groupStore.groups.some((g) => g.groupUuid === groupUuid)
}

// Map Helper
function mapUserResult(item: any) {
  return {
    ...item,
    avatar: resolveAssetUrl(item.avatar),
    signature: item.signature || '暂无个性签名'
  }
}

// 无头像图时的首字色块：按 UUID 稳定着色，与聊天/通讯录保持一致
function avatarBlockStyle(id: string): Record<string, string> {
  const palette = avatarPaletteFromId(id)
  return { background: palette.bg, color: palette.fg }
}

// Watch Query string
watch(
  () => route.query.target,
  (newTarget) => {
    if (newTarget && typeof newTarget === 'string') {
      searchKeyword.value = newTarget
      activeTab.value = 'user'
      handleSearch()
    }
  },
  { immediate: true }
)

// Active Tab watch -> clear
watch(activeTab, () => {
  searchKeyword.value = ''
  searchResultsUsers.value = []
  searchResultsGroups.value = []
  qrInput.value = ''
  parsedUser.value = null
})

// Unified Search Trigger
async function handleSearch() {
  const keyword = searchKeyword.value.trim()
  if (!keyword || searching.value) return

  searching.value = true
  try {
    if (activeTab.value === 'user') {
      const response = await searchUsers({ keyword, page: 1, pageSize: 30 })
      const mapped = (response.data.items ?? []).map(mapUserResult)
      searchResultsUsers.value = mapped.filter((item) => item.uuid && item.uuid !== userUuid.value)

      // Batch sync presence states for results
      const uuids = searchResultsUsers.value.map((item) => item.uuid)
      if (uuids.length > 0) {
        presenceStore.syncBatch(uuids)
      }

      if (searchResultsUsers.value.length === 0) {
        toast.info('没有找到匹配的用户')
      }
    } else if (activeTab.value === 'group') {
      const response = await apiSearchGroups({ keyword, page: 1, pageSize: 30 })
      searchResultsGroups.value = response.data.groups || []
      if (searchResultsGroups.value.length === 0) {
        toast.info('没有找到匹配的群组')
      }
    }
  } catch (error) {
    toast.error(normalizeErrorMessage(error))
  } finally {
    searching.value = false
  }
}

// Parse QR input
async function handleParseQRCode() {
  const input = qrInput.value.trim()
  if (!input || parsingQr.value) return

  parsingQr.value = true
  parsedUser.value = null
  try {
    const targetUuid = await userStore.parseQRCodeToUserUuid(input)
    const response = await fetchOtherProfile(targetUuid)
    const profileData = response.data.userInfo
    if (profileData) {
      parsedUser.value = mapUserResult(profileData)
      presenceStore.syncSingle(targetUuid)
      toast.success('成功解析二维码并找到用户')
    } else {
      toast.error('未找到该用户的详细资料')
    }
  } catch (error) {
    toast.error(normalizeErrorMessage(error))
  } finally {
    parsingQr.value = false
  }
}

// Open Apply Dialogue
function openApplyModal(type: 'user' | 'group', targetUuid: string, targetName: string) {
  applyModalType.value = type
  applyModalTargetUuid.value = targetUuid
  applyModalTargetName.value = targetName
  applyModalReason.value = type === 'user' ? '我是 LCChat 用户' : '申请加入群组'
  isApplyModalOpen.value = true
}

// Submit apply details
async function submitApply() {
  const targetUuid = applyModalTargetUuid.value
  const reason = applyModalReason.value.trim()
  if (!targetUuid || applySubmitting.value) return

  applySubmitting.value = true
  try {
    if (applyModalType.value === 'user') {
      await sendFriendApply({
        targetUuid,
        reason: reason || undefined,
        source: 'desktop_search'
      })
      toast.success(`加好友申请已发送给 ${applyModalTargetName.value}`)
      await applyStore.syncSentFromServer(userUuid.value)
    } else {
      await groupStore.applyJoin(targetUuid, reason)
      toast.success(`加群申请已提交：${applyModalTargetName.value}`)
      await groupStore.syncMyJoinApplications()
    }
    isApplyModalOpen.value = false
  } catch (error) {
    if (applyModalType.value === 'user') {
      toast.error(resolveRelationErrorMessage('send_friend_apply', error))
    } else {
      toast.error(normalizeErrorMessage(error))
    }
  } finally {
    applySubmitting.value = false
  }
}

// Quick join (Direct join without approval)
async function handleDirectJoinGroup(groupUuid: string, groupName: string) {
  try {
    toast.loading('正在加入群组...', { id: 'join-group' })
    await groupStore.applyJoin(groupUuid)
    toast.success(`您已直接成功加入群组 "${groupName}"！`, { id: 'join-group' })
    await groupStore.syncGroups()

    // Smooth navigation into Chat workspace
    setTimeout(async () => {
      try {
        await openChatConversation({
          sessionStore,
          router,
          targetUuid: groupUuid,
          convType: 2,
          currentUserUuid: authStore.userUuid
        })
      } catch (err) {
        console.error(err)
      }
    }, 600)
  } catch (error) {
    toast.error(normalizeErrorMessage(error), { id: 'join-group' })
  }
}

// Smooth conversation navigation for friends
async function handleStartP2PChat(peerUuid: string) {
  try {
    await openChatConversation({
      sessionStore,
      router,
      targetUuid: peerUuid,
      convType: 1,
      currentUserUuid: authStore.userUuid
    })
  } catch (error) {
    toast.error('无法发起聊天：' + normalizeErrorMessage(error))
  }
}

// Copy & Export Qr Code
async function copyQRCodeUrl() {
  if (!qrCode.value?.qrCode) return
  try {
    await writeTextToClipboard(qrCode.value.qrCode)
    localCopyFeedback.value = '链接已成功复制！'
    setTimeout(() => {
      localCopyFeedback.value = ''
    }, 2500)
    toast.success('二维码链接已复制到剪贴板')
  } catch (err) {
    toast.error('复制失败，请重试')
  }
}

async function exportQRCodeImage() {
  if (!qrImageUrl.value || exportPending.value) return
  exportPending.value = true
  try {
    const response = await fetch(qrImageUrl.value)
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = objectUrl
    link.download = `lcchat-qrcode-${Date.now()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(objectUrl)
    toast.success('二维码图片已成功导出')
  } catch (err) {
    toast.error('导出失败，请重试')
  } finally {
    exportPending.value = false
  }
}

async function handleRefreshQr() {
  try {
    toast.loading('正在刷新二维码...', { id: 'refresh-qr' })
    await userStore.loadQRCode()
    toast.success('二维码已刷新', { id: 'refresh-qr' })
  } catch (err) {
    toast.error('刷新失败，请检查网络', { id: 'refresh-qr' })
  }
}

onMounted(() => {
  // Ensure QR Code is loaded for side display
  if (!qrCode.value) {
    userStore.loadQRCode().catch(() => {})
  }
})
</script>

<template>
  <main class="flex-1 h-full min-h-0 overflow-hidden flex flex-col bg-[var(--c-bg-panel-soft)]">
    <!-- Header -->
    <header
      class="w-full px-8 py-5 border-b border-[var(--c-border)] bg-[var(--c-bg-panel)] backdrop-blur-xl flex justify-between items-center z-10"
    >
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-xl bg-[var(--c-primary-soft)] grid place-items-center text-[var(--c-primary)] shadow-inner"
        >
          <Sparkles :size="20" stroke-width="2.5" class="animate-pulse" />
        </div>
        <div>
          <h2 class="text-lg font-bold text-[var(--c-text-main)] leading-tight">发现中心</h2>
          <p class="text-xs text-[var(--c-text-sub)]">搜索并扩充您的社交关系链，发现精彩群聊</p>
        </div>
      </div>
    </header>

    <!-- Unified Workspace with 2 columns: Search Main (8cols) and My QR Sidebar (4cols) -->
    <div class="flex-1 min-h-0 overflow-y-auto">
      <div class="grid grid-cols-1 xl:grid-cols-12 gap-8 p-8 max-w-7xl mx-auto w-full">
        <!-- Left Main Column -->
        <section class="xl:col-span-8 flex flex-col gap-6">
          <!-- Modern Tab Toggles -->
          <div
            class="p-1.5 bg-white/70 dark:bg-zinc-900/50 backdrop-blur-md rounded-2xl border border-[var(--c-border)] flex gap-2"
          >
            <button
              @click="activeTab = 'user'"
              class="flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2.5 text-sm font-semibold transition-all duration-300"
              :class="
                activeTab === 'user'
                  ? 'bg-[var(--c-primary)] text-white shadow-lg shadow-[var(--c-primary-soft)] transform scale-[1.02]'
                  : 'text-[var(--c-text-sub)] hover:text-[var(--c-text-main)] hover:bg-[var(--c-bg-panel-soft)]'
              "
            >
              <UserPlus :size="16" />
              查找用户
            </button>
            <button
              @click="activeTab = 'group'"
              class="flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2.5 text-sm font-semibold transition-all duration-300"
              :class="
                activeTab === 'group'
                  ? 'bg-[var(--c-primary)] text-white shadow-lg shadow-[var(--c-primary-soft)] transform scale-[1.02]'
                  : 'text-[var(--c-text-sub)] hover:text-[var(--c-text-main)] hover:bg-[var(--c-bg-panel-soft)]'
              "
            >
              <Users :size="16" />
              查找群组
            </button>
            <button
              @click="activeTab = 'scan'"
              class="flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2.5 text-sm font-semibold transition-all duration-300"
              :class="
                activeTab === 'scan'
                  ? 'bg-[var(--c-primary)] text-white shadow-lg shadow-[var(--c-primary-soft)] transform scale-[1.02]'
                  : 'text-[var(--c-text-sub)] hover:text-[var(--c-text-main)] hover:bg-[var(--c-bg-panel-soft)]'
              "
            >
              <QrCode :size="16" />
              解析二维码
            </button>
          </div>

          <!-- Active tab search panel wrapper -->
          <div
            class="bg-white/70 dark:bg-zinc-900/50 backdrop-blur-md rounded-3xl border border-[var(--c-border)] p-6 shadow-sm flex flex-col gap-6"
          >
            <!-- 1 & 2. Search Users / Groups Tab View -->
            <div v-if="activeTab === 'user' || activeTab === 'group'" class="flex flex-col gap-5">
              <h3 class="text-sm font-bold text-[var(--c-text-main)]">
                {{ activeTab === 'user' ? '查找 LCChat 用户' : '探索 LCChat 群聊' }}
              </h3>

              <div class="flex gap-3">
                <div class="flex-1 relative">
                  <Search
                    class="absolute left-4 top-3.5 text-gray-400 w-4 h-4 pointer-events-none"
                  />
                  <input
                    v-model="searchKeyword"
                    type="text"
                    :placeholder="
                      activeTab === 'user'
                        ? '输入用户 UUID / 邮箱 / 昵称关键词...'
                        : '输入群组 UUID / 名称关键词...'
                    "
                    @keyup.enter="handleSearch"
                    class="w-full pl-11 pr-4 py-3 bg-[var(--c-bg-panel-soft)] border border-[var(--c-border)] rounded-xl focus:bg-white focus:border-[var(--c-primary)] focus:ring-4 focus:ring-[var(--c-primary-soft)] transition-all outline-none text-sm text-[var(--c-text-main)]"
                  />
                </div>
                <button
                  @click="handleSearch"
                  :disabled="searching || !searchKeyword.trim()"
                  class="px-6 py-3 bg-[var(--c-primary)] hover:bg-[var(--c-primary-active)] text-white rounded-xl font-semibold text-sm transition-all shadow-md shadow-[var(--c-primary-soft)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <RefreshCw v-if="searching" :size="14" class="animate-spin" />
                  {{ searching ? '搜索中...' : '搜索' }}
                </button>
              </div>
            </div>

            <!-- 3. Scan & Parse Tab View -->
            <div v-else class="flex flex-col gap-5">
              <div>
                <h3 class="text-sm font-bold text-[var(--c-text-main)]">解析二维码链接或 Token</h3>
                <p class="text-xs text-[var(--c-text-sub)] mt-1">
                  支持粘贴完整的 LCChat 二维码链接，或者直接粘贴提取出的安全解析 Token
                  进行精确定位。
                </p>
              </div>

              <div class="flex gap-3">
                <input
                  v-model="qrInput"
                  type="text"
                  placeholder="粘贴二维码网址或 Token (例如: lcchat://profile?token=...)"
                  @keyup.enter="handleParseQRCode"
                  class="flex-1 px-4 py-3 bg-[var(--c-bg-panel-soft)] border border-[var(--c-border)] rounded-xl focus:bg-white focus:border-[var(--c-primary)] focus:ring-4 focus:ring-[var(--c-primary-soft)] transition-all outline-none text-sm text-[var(--c-text-main)]"
                />
                <button
                  @click="handleParseQRCode"
                  :disabled="parsingQr || !qrInput.trim()"
                  class="px-6 py-3 bg-[var(--c-primary)] hover:bg-[var(--c-primary-active)] text-white rounded-xl font-semibold text-sm transition-all shadow-md shadow-[var(--c-primary-soft)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <RefreshCw v-if="parsingQr" :size="14" class="animate-spin" />
                  {{ parsingQr ? '解析中...' : '解析并查找' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Results Display Area -->
          <div class="flex flex-col gap-4">
            <!-- Searching loading placeholder -->
            <div
              v-if="searching || parsingQr"
              class="py-12 bg-white/40 rounded-3xl border border-[var(--c-border)] grid place-items-center"
            >
              <div class="flex flex-col items-center gap-3">
                <RefreshCw class="w-8 h-8 text-[var(--c-primary)] animate-spin" />
                <p class="text-xs text-[var(--c-text-sub)] font-semibold animate-pulse">
                  正在获取最新匹配结果...
                </p>
              </div>
            </div>

            <template v-else>
              <!-- A. User Search Results List -->
              <div
                v-if="activeTab === 'user' && searchResultsUsers.length > 0"
                class="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                <div
                  v-for="user in searchResultsUsers"
                  :key="user.uuid"
                  class="p-5 bg-white/80 dark:bg-zinc-900/60 rounded-3xl border border-[var(--c-border)] hover:border-emerald-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-between gap-4 group"
                >
                  <div class="flex items-center gap-4 min-w-0">
                    <!-- Avatar with Pulse state -->
                    <div
                      class="w-12 h-12 rounded-2xl bg-gray-100 border border-[var(--c-border)] overflow-hidden relative flex-shrink-0"
                    >
                      <img
                        v-if="user.avatar"
                        :src="user.avatar"
                        alt="avatar"
                        class="w-full h-full object-cover"
                      />
                      <div
                        v-else
                        class="w-full h-full grid place-items-center font-bold text-lg"
                        :style="avatarBlockStyle(user.uuid)"
                      >
                        {{ avatarInitial(user.nickname || user.uuid) }}
                      </div>

                      <!-- Real-time Presence sync dot -->
                      <span
                        v-if="presenceStore.getStatus(user.uuid)?.isOnline"
                        class="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full pulse-indicator"
                      />
                    </div>

                    <!-- User metadata details -->
                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5">
                        <strong
                          class="text-sm font-bold text-[var(--c-text-main)] truncate block"
                          >{{ user.nickname || '未设定昵称' }}</strong
                        >
                        <span
                          class="px-1.5 py-0.5 text-[9px] font-semibold bg-gray-100 dark:bg-zinc-800 text-[var(--c-text-sub)] rounded"
                          >UUID</span
                        >
                      </div>
                      <p class="text-[10px] text-[var(--c-text-sub)] truncate select-all mt-0.5">
                        {{ user.uuid }}
                      </p>
                      <p class="text-xs text-[var(--c-text-sub)] truncate mt-1.5 italic">
                        “{{ user.signature }}”
                      </p>
                    </div>
                  </div>

                  <!-- Actions -->
                  <div class="flex-shrink-0">
                    <span
                      v-if="isSelf(user.uuid)"
                      class="px-3 py-1.5 bg-gray-100 text-[var(--c-text-sub)] font-semibold text-xs rounded-xl flex items-center gap-1"
                    >
                      <UserCheck :size="12" />
                      这是你自己
                    </span>
                    <button
                      v-else-if="isFriend(user.uuid)"
                      @click="handleStartP2PChat(user.uuid)"
                      class="px-4 py-2 bg-[var(--c-primary-soft)] hover:bg-[var(--c-primary)] hover:text-white text-[var(--c-primary)] font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
                    >
                      <MessageSquare :size="12" />
                      发消息
                    </button>
                    <span
                      v-else-if="isBlacklisted(user.uuid)"
                      class="px-3 py-1.5 bg-red-50 text-red-500 font-semibold text-xs rounded-xl flex items-center gap-1"
                    >
                      <AlertCircle :size="12" />
                      黑名单中
                    </span>
                    <button
                      v-else
                      @click="openApplyModal('user', user.uuid, user.nickname || user.uuid)"
                      class="px-4 py-2 bg-[var(--c-primary)] hover:bg-[var(--c-primary-active)] text-white font-bold text-xs rounded-xl transition-all shadow-sm shadow-[var(--c-primary-soft)] flex items-center gap-1"
                    >
                      <UserPlus :size="12" />
                      加好友
                    </button>
                  </div>
                </div>
              </div>

              <!-- B. Group Search Results List -->
              <div
                v-else-if="activeTab === 'group' && searchResultsGroups.length > 0"
                class="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                <div
                  v-for="group in searchResultsGroups"
                  :key="group.groupUuid"
                  class="p-5 bg-white/80 dark:bg-zinc-900/60 rounded-3xl border border-[var(--c-border)] hover:border-emerald-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-between gap-4"
                >
                  <div class="flex items-center gap-4 min-w-0">
                    <!-- Elegant characters fallback avatar -->
                    <div
                      class="w-12 h-12 rounded-2xl bg-gray-100 border border-[var(--c-border)] overflow-hidden flex-shrink-0"
                    >
                      <img
                        v-if="group.avatar"
                        :src="resolveAssetUrl(group.avatar)"
                        alt="group-avatar"
                        class="w-full h-full object-cover"
                      />
                      <div
                        v-else
                        class="w-full h-full grid place-items-center font-bold text-lg"
                        :style="avatarBlockStyle(group.groupUuid)"
                      >
                        {{ avatarInitial(group.name) }}
                      </div>
                    </div>

                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <strong
                          class="text-sm font-bold text-[var(--c-text-main)] truncate block"
                          >{{ group.name }}</strong
                        >
                      </div>
                      <p class="text-[10px] text-[var(--c-text-sub)] truncate select-all mt-0.5">
                        {{ group.groupUuid }}
                      </p>

                      <div class="flex items-center gap-2 mt-2">
                        <span
                          class="px-2 py-0.5 text-[10px] font-semibold bg-[var(--c-bg-panel-soft)] text-[var(--c-text-sub)] rounded-full border border-[var(--c-border)]"
                        >
                          成员: {{ group.memberCount }} 人
                        </span>
                        <span
                          class="px-2 py-0.5 text-[10px] font-semibold rounded-full border"
                          :class="
                            group.addMode === 0
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                              : 'bg-amber-50 text-amber-600 border-amber-100'
                          "
                        >
                          {{ group.addMode === 0 ? '直接加入' : '需审批' }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- Actions -->
                  <div class="flex-shrink-0">
                    <span
                      v-if="isGroupJoined(group.groupUuid)"
                      class="px-3 py-1.5 bg-gray-100 text-[var(--c-text-sub)] font-semibold text-xs rounded-xl flex items-center gap-1"
                    >
                      <Check :size="12" />
                      已加入
                    </span>
                    <button
                      v-else-if="group.addMode === 0"
                      @click="handleDirectJoinGroup(group.groupUuid, group.name)"
                      class="px-4 py-2 bg-[var(--c-primary)] hover:bg-[var(--c-primary-active)] text-white font-bold text-xs rounded-xl transition-all shadow-sm shadow-[var(--c-primary-soft)] flex items-center gap-1"
                    >
                      加入群组
                    </button>
                    <button
                      v-else
                      @click="openApplyModal('group', group.groupUuid, group.name)"
                      class="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1"
                    >
                      申请加入
                    </button>
                  </div>
                </div>
              </div>

              <!-- C. Scan QR Parse Profile Result -->
              <div v-else-if="activeTab === 'scan' && parsedUser" class="flex justify-center py-4">
                <div
                  class="max-w-md w-full p-6 bg-white/90 dark:bg-zinc-900/70 border border-[var(--c-border)] rounded-[32px] shadow-lg flex flex-col items-center text-center gap-5"
                >
                  <div
                    class="w-20 h-20 rounded-[28px] border border-[var(--c-border)] overflow-hidden bg-gray-50 shadow-md relative"
                  >
                    <img
                      v-if="parsedUser.avatar"
                      :src="parsedUser.avatar"
                      alt="avatar"
                      class="w-full h-full object-cover"
                    />
                    <div
                      v-else
                      class="w-full h-full grid place-items-center text-2xl font-bold"
                      :style="avatarBlockStyle(parsedUser.uuid)"
                    >
                      {{ avatarInitial(parsedUser.nickname || parsedUser.uuid) }}
                    </div>

                    <span
                      v-if="presenceStore.getStatus(parsedUser.uuid)?.isOnline"
                      class="absolute bottom-1 right-1 w-4.5 h-4.5 bg-emerald-500 border-2 border-white rounded-full pulse-indicator"
                    />
                  </div>

                  <div>
                    <h4 class="text-base font-bold text-[var(--c-text-main)]">
                      {{ parsedUser.nickname || '未设定昵称' }}
                    </h4>
                    <p class="text-xs text-[var(--c-text-sub)] mt-1 select-all font-mono">
                      {{ parsedUser.uuid }}
                    </p>
                    <p
                      class="text-xs text-[var(--c-text-sub)] mt-3 bg-[var(--c-bg-panel-soft)] px-4 py-2 rounded-2xl italic border border-[var(--c-border)] max-w-sm"
                    >
                      “{{ parsedUser.signature }}”
                    </p>
                  </div>

                  <div
                    class="w-full border-t border-[var(--c-border)] pt-4 flex justify-center gap-4"
                  >
                    <span
                      v-if="isSelf(parsedUser.uuid)"
                      class="px-4 py-2 bg-gray-100 text-[var(--c-text-sub)] font-semibold text-xs rounded-xl flex items-center gap-1"
                    >
                      <UserCheck :size="14" />
                      这是你自己
                    </span>
                    <button
                      v-else-if="isFriend(parsedUser.uuid)"
                      @click="handleStartP2PChat(parsedUser.uuid)"
                      class="px-6 py-2.5 bg-[var(--c-primary-soft)] hover:bg-[var(--c-primary)] hover:text-white text-[var(--c-primary)] font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
                    >
                      <MessageSquare :size="14" />
                      已是好友，直接聊天
                    </button>
                    <span
                      v-else-if="isBlacklisted(parsedUser.uuid)"
                      class="px-4 py-2 bg-red-50 text-red-500 font-semibold text-xs rounded-xl flex items-center gap-1"
                    >
                      <AlertCircle :size="14" />
                      对方已在黑名单中
                    </span>
                    <button
                      v-else
                      @click="
                        openApplyModal(
                          'user',
                          parsedUser.uuid,
                          parsedUser.nickname || parsedUser.uuid
                        )
                      "
                      class="px-6 py-2.5 bg-[var(--c-primary)] hover:bg-[var(--c-primary-active)] text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-[var(--c-primary-soft)] flex items-center gap-1.5"
                    >
                      <UserPlus :size="14" />
                      申请添加为好友
                    </button>
                  </div>
                </div>
              </div>

              <!-- D. Empty Results Default View -->
              <div
                v-else-if="searchKeyword"
                class="py-16 bg-white/40 rounded-3xl border border-[var(--c-border)] grid place-items-center"
              >
                <div class="flex flex-col items-center text-center gap-3 max-w-xs">
                  <Info class="w-8 h-8 text-gray-400" />
                  <h4 class="text-sm font-bold text-[var(--c-text-main)]">未找到匹配项</h4>
                  <p class="text-xs text-[var(--c-text-sub)]">
                    请确保您的输入绝对正确。模糊搜索支持昵称或部分 UUID，精确搜索支持完整的 UUID。
                  </p>
                </div>
              </div>
            </template>
          </div>
        </section>

        <!-- Right Sidebar (My Personal QR Code business card) -->
        <section class="xl:col-span-4 flex flex-col gap-6">
          <div
            class="bg-white/70 dark:bg-zinc-900/50 backdrop-blur-md rounded-3xl border border-[var(--c-border)] p-6 shadow-sm flex flex-col gap-5"
          >
            <header class="flex justify-between items-center">
              <h3 class="text-sm font-bold text-[var(--c-text-main)]">我的名片码</h3>
              <button
                @click="handleRefreshQr"
                class="w-8 h-8 rounded-lg bg-[var(--c-bg-panel-soft)] hover:bg-[var(--c-primary-soft)] hover:text-[var(--c-primary)] transition-all grid place-items-center border border-[var(--c-border)]"
                title="刷新二维码"
              >
                <RefreshCw :size="14" />
              </button>
            </header>

            <p class="text-xs text-[var(--c-text-sub)] leading-normal">
              向其他用户提供您的二维码链接或 Token，即可轻松被发现并建立联系。
            </p>

            <!-- Business Card Layout -->
            <div
              class="bg-gradient-to-b from-white to-[var(--c-bg-panel)] border border-[var(--c-border)] rounded-2xl p-5 flex flex-col items-center shadow-inner relative overflow-hidden group"
            >
              <!-- Grid background deco -->
              <div
                class="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] pointer-events-none opacity-30"
              />

              <!-- Personal Info Profile Header -->
              <div
                class="flex items-center gap-3.5 w-full mb-4 z-10 border-b border-[var(--c-border)] pb-3"
              >
                <div
                  class="w-10 h-10 rounded-xl bg-[var(--c-bg-panel-soft)] border border-[var(--c-border)] overflow-hidden"
                >
                  <img
                    v-if="profile?.payload?.avatar"
                    :src="resolveAssetUrl(profile.payload.avatar as string)"
                    alt="my-avatar"
                    class="w-full h-full object-cover"
                  />
                  <div
                    v-else
                    class="w-full h-full grid place-items-center text-base font-bold"
                    :style="avatarBlockStyle(authStore.userUuid)"
                  >
                    {{ avatarInitial(String(profile?.payload?.nickname || '我')) }}
                  </div>
                </div>
                <div class="min-w-0">
                  <strong class="text-xs font-bold text-[var(--c-text-main)] truncate block">
                    {{ profile?.payload?.nickname || '我的昵称' }}
                  </strong>
                  <p
                    class="text-[9px] text-[var(--c-text-sub)] truncate select-all font-mono mt-0.5"
                  >
                    {{ profile?.payload?.uuid || authStore.userUuid }}
                  </p>
                </div>
              </div>

              <!-- QR Code Preview box -->
              <div
                class="w-48 h-48 bg-white rounded-xl border border-[var(--c-border)] p-2 shadow-md relative overflow-hidden flex items-center justify-center z-10 group-hover:scale-[1.02] transition-transform duration-300"
              >
                <img
                  v-if="qrImageUrl"
                  :src="qrImageUrl"
                  alt="my-qr"
                  class="w-full h-full object-contain"
                />
                <div v-else class="text-center p-4">
                  <RefreshCw class="w-6 h-6 text-gray-300 animate-spin mx-auto mb-2" />
                  <p class="text-[10px] text-[var(--c-text-sub)]">名片未生成</p>
                </div>
              </div>

              <span class="text-[10px] text-[var(--c-text-sub)] text-center mt-3 z-10 font-medium"
                >在 LCChat 中扫描以上二维码添加好友</span
              >
            </div>

            <!-- Actions list -->
            <div class="flex flex-col gap-2 mt-1">
              <div class="flex gap-2">
                <button
                  @click="copyQRCodeUrl"
                  :disabled="!qrCode?.qrCode"
                  class="flex-1 py-2.5 px-3 bg-[var(--c-bg-panel-soft)] hover:bg-[var(--c-primary-soft)] hover:text-[var(--c-primary)] text-[var(--c-text-main)] font-semibold text-xs rounded-xl border border-[var(--c-border)] transition-all flex items-center justify-center gap-1.5"
                >
                  <Copy :size="13" />
                  复制链接
                </button>
                <button
                  @click="exportQRCodeImage"
                  :disabled="!qrImageUrl || exportPending"
                  class="flex-1 py-2.5 px-3 bg-[var(--c-bg-panel-soft)] hover:bg-[var(--c-primary-soft)] hover:text-[var(--c-primary)] text-[var(--c-text-main)] font-semibold text-xs rounded-xl border border-[var(--c-border)] transition-all flex items-center justify-center gap-1.5"
                >
                  <Download :size="13" />
                  保存图片
                </button>
              </div>

              <div
                class="bg-[var(--c-bg-panel-soft)] border border-[var(--c-border)] rounded-xl p-3 mt-1 flex flex-col gap-1.5 text-[10px]"
              >
                <div class="flex justify-between">
                  <span class="text-[var(--c-text-sub)]">Token</span>
                  <span
                    class="font-mono text-[var(--c-text-main)] font-semibold max-w-[120px] truncate select-all"
                    >{{ qrCode?.token || '-' }}</span
                  >
                </div>
                <div class="flex justify-between">
                  <span class="text-[var(--c-text-sub)]">过期时间</span>
                  <span class="text-[var(--c-text-main)] font-semibold">{{ qrExpireText }}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- Elegant custom Radix-Vue apply modal dialog -->
    <DialogRoot :open="isApplyModalOpen" @update:open="isApplyModalOpen = $event">
      <DialogPortal>
        <DialogOverlay
          class="bg-black/35 fixed inset-0 z-50 backdrop-blur-sm transition-all duration-300"
        />
        <DialogContent
          class="fixed top-[50%] left-[50%] w-full max-w-[420px] translate-x-[-50%] translate-y-[-50%] rounded-[24px] bg-[var(--c-bg-panel-solid)] border border-white/20 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-50 outline-none backdrop-blur-md flex flex-col gap-4"
        >
          <DialogTitle class="text-sm font-bold text-[var(--c-text-main)] flex items-center gap-2">
            <Sparkles class="w-4 h-4 text-[var(--c-primary)]" />
            {{ applyModalType === 'user' ? '申请添加好友' : '申请加入群组' }}
          </DialogTitle>

          <div
            class="bg-[var(--c-bg-panel-soft)] p-3 rounded-xl border border-[var(--c-border)] flex items-center justify-between text-xs"
          >
            <span class="text-[var(--c-text-sub)]">目标对象</span>
            <strong class="text-[var(--c-text-main)] truncate max-w-[200px]">{{
              applyModalTargetName
            }}</strong>
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-[11px] font-bold text-[var(--c-text-sub)]">申请理由 / 问候语</label>
            <textarea
              v-model="applyModalReason"
              rows="3"
              maxlength="100"
              placeholder="请填写简短附言，增加通过概率..."
              class="w-full px-3.5 py-2.5 bg-[var(--c-bg-panel-soft)] border border-[var(--c-border)] rounded-xl focus:bg-white focus:border-[var(--c-primary)] focus:ring-4 focus:ring-[var(--c-primary-soft)] transition-all outline-none text-xs text-[var(--c-text-main)] resize-none"
            />
          </div>

          <!-- Prefill preset phrase chips -->
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="phrase in quickPhrases"
              :key="phrase"
              @click="applyModalReason = phrase"
              type="button"
              class="px-2.5 py-1 text-[10px] bg-[var(--c-bg-panel-soft)] hover:bg-[var(--c-primary-soft)] hover:text-[var(--c-primary)] border border-[var(--c-border)] rounded-full transition-colors text-[var(--c-text-sub)] font-medium"
            >
              {{ phrase }}
            </button>
          </div>

          <div class="flex justify-end gap-2.5 mt-4 border-t border-[var(--c-border)] pt-4">
            <DialogClose as-child>
              <button
                class="px-4 py-2 border border-[var(--c-border)] hover:bg-[var(--c-bg-panel-soft)] text-[var(--c-text-sub)] font-semibold text-xs rounded-xl transition-colors"
              >
                取消
              </button>
            </DialogClose>
            <button
              @click="submitApply"
              :disabled="applySubmitting"
              class="px-5 py-2 bg-[var(--c-primary)] hover:bg-[var(--c-primary-active)] text-white font-bold text-xs rounded-xl transition-all shadow-sm shadow-[var(--c-primary-soft)] disabled:opacity-50 flex items-center gap-1.5"
            >
              <Send :size="12" />
              {{ applySubmitting ? '正在提交...' : '确认发送' }}
            </button>
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </main>
</template>

<style scoped>
.pulse-indicator {
  box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
  animation: pulse-ring 1.8s cubic-bezier(0.24, 0, 0.38, 1) infinite;
}

@keyframes pulse-ring {
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  }
  70% {
    transform: scale(1);
    box-shadow: 0 0 0 5px rgba(16, 185, 129, 0);
  }
  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
  }
}
</style>
