<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import {
  User,
  UserPlus,
  Users,
  ShieldAlert,
  Search,
  Copy,
  Check,
  MessageSquare,
  Trash2,
  Edit3,
  ShieldCheck,
  Mail,
  Calendar,
  VolumeX,
  Volume2,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink
} from 'lucide-vue-next'
import { useFriendStore } from '../../../stores/friend.store'
import { useApplyStore } from '../../../stores/apply.store'
import { useBlacklistStore } from '../../../stores/blacklist.store'
import { usePresenceStore } from '../../../stores/presence.store'
import { useAuthStore } from '../../../stores/auth.store'
import { useGroupStore } from '../../../stores/group.store'
import { buildP2PConversationId, useSessionStore } from '../../../stores/session.store'
import { useAppStore } from '../../../stores/app.store'
import { toast } from 'vue-sonner'
import SkeletonLoader from '../../../shared/components/SkeletonLoader.vue'
import { normalizeErrorMessage } from '../../../shared/utils/error'

const router = useRouter()
const authStore = useAuthStore()
const friendStore = useFriendStore()
const applyStore = useApplyStore()
const blacklistStore = useBlacklistStore()
const presenceStore = usePresenceStore()
const groupStore = useGroupStore()
const sessionStore = useSessionStore()

const { friends, tagSuggestions } = storeToRefs(friendStore)
const { inbox: applyInbox, sent: sentApplies, unreadCount } = storeToRefs(applyStore)
const { items: blacklistItems } = storeToRefs(blacklistStore)
const { statusByUserUuid } = storeToRefs(presenceStore)
const { groups } = storeToRefs(groupStore)

// Navigation state
const appStore = useAppStore()
const activeTab = computed({
  get: () => appStore.contactActiveTab,
  set: (val) => appStore.setContactActiveTab(val)
})
const applySubTab = ref<'inbox' | 'sent'>('inbox')
const searchQuery = ref('')

// Selection state
const selectedFriendId = ref('')
const selectedApplyId = ref<number | null>(null)
const selectedGroupId = ref('')
const selectedBlacklistId = ref('')

// Interactive edits
const remarkEditVal = ref('')
const isEditingRemark = ref(false)
const tagEditVal = ref('')
const isEditingTag = ref(false)
const applyRemarks = ref('')
const isCopied = ref(false)
const copiedId = ref('')

// Group details states
const isEditingNotice = ref(false)
const groupNoticeText = ref('')
const myGroupNickname = ref('')
const isEditingMyNickname = ref(false)

const loading = ref(false)

// Sync everything on mount
onMounted(async () => {
  const userUuid = authStore.userUuid
  if (userUuid) {
    loading.value = true
    try {
      await Promise.allSettled([
        friendStore.syncFromServer(userUuid),
        applyStore.syncInboxFromServer(userUuid),
        applyStore.syncSentFromServer(userUuid),
        groupStore.syncGroups(),
        blacklistStore.syncFromServer(userUuid)
      ])
    } finally {
      loading.value = false
    }
  }
})

// Sync online statuses when friends load
watch(() => friends.value, (newFriends) => {
  if (newFriends && newFriends.length > 0) {
    const uuids = newFriends.map(f => f.peerUuid)
    presenceStore.syncBatch(uuids)
  }
}, { immediate: true })

// Reset selection when changing category tab
function handleTabChange(tab: 'friends' | 'applies' | 'groups' | 'blacklist') {
  activeTab.value = tab
  searchQuery.value = ''
  selectedFriendId.value = ''
  selectedApplyId.value = null
  selectedGroupId.value = ''
  selectedBlacklistId.value = ''
  isEditingRemark.value = false
  isEditingTag.value = false
  isEditingNotice.value = false
  isEditingMyNickname.value = false
}

// Copy UUID Helper
function copyToClipboard(text: string) {
  if (!text) return
  navigator.clipboard.writeText(text)
  copiedId.value = text
  isCopied.value = true
  setTimeout(() => {
    isCopied.value = false
    copiedId.value = ''
  }, 2000)
}

// Active computed selections
const selectedFriend = computed(() => {
  return friends.value.find(f => f.peerUuid === selectedFriendId.value) || null
})

const selectedApply = computed(() => {
  if (selectedApplyId.value === null) return null
  const pool = applySubTab.value === 'inbox' ? applyInbox.value : sentApplies.value
  return pool.find(a => a.applyId === selectedApplyId.value) || null
})

const selectedGroup = computed(() => {
  return groups.value.find(g => g.groupUuid === selectedGroupId.value) || null
})

const selectedBlacklistedUser = computed(() => {
  return blacklistItems.value.find(b => b.peerUuid === selectedBlacklistId.value) || null
})

// Mapped search filtering
const filteredFriends = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return friends.value
  return friends.value.filter(f => {
    const remark = String(f.payload.remark || '').toLowerCase()
    const nickname = String(f.payload.nickname || '').toLowerCase()
    const uuid = f.peerUuid.toLowerCase()
    const tag = String(f.payload.groupTag || '').toLowerCase()
    return remark.includes(q) || nickname.includes(q) || uuid.includes(q) || tag.includes(q)
  })
})

const filteredApplies = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const pool = applySubTab.value === 'inbox' ? applyInbox.value : sentApplies.value
  if (!q) return pool
  return pool.filter(a => {
    const nick = String(a.payload.applicantNickname || a.payload.targetNickname || '').toLowerCase()
    const uuid = String(a.payload.applicantUuid || a.payload.targetUuid || '').toLowerCase()
    const reason = String(a.payload.reason || '').toLowerCase()
    return nick.includes(q) || uuid.includes(q) || reason.includes(q)
  })
})

const filteredGroups = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return groups.value
  return groups.value.filter(g => {
    const name = g.name.toLowerCase()
    const uuid = g.groupUuid.toLowerCase()
    const notice = String(g.notice || '').toLowerCase()
    return name.includes(q) || uuid.includes(q) || notice.includes(q)
  })
})

const filteredBlacklist = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return blacklistItems.value
  return blacklistItems.value.filter(b => {
    const nickname = String(b.payload.nickname || '').toLowerCase()
    const uuid = b.peerUuid.toLowerCase()
    return nickname.includes(q) || uuid.includes(q)
  })
})

// Friend actions
async function saveFriendRemark() {
  if (!selectedFriendId.value) return
  try {
    await friendStore.updateFriendRemark(authStore.userUuid, selectedFriendId.value, remarkEditVal.value)
    isEditingRemark.value = false
    toast.success('好友备注已更新')
  } catch (error) {
    toast.error('更新备注失败，请重试')
  }
}

async function saveFriendTag() {
  if (!selectedFriendId.value) return
  try {
    await friendStore.updateFriendTag(authStore.userUuid, selectedFriendId.value, tagEditVal.value)
    isEditingTag.value = false
    toast.success('分组标签已更新')
  } catch (error) {
    toast.error('更新标签失败，请重试')
  }
}

async function applyQuickTag(tagName: string) {
  if (!selectedFriendId.value) return
  tagEditVal.value = tagName
  await saveFriendTag()
}

async function startEditRemark() {
  if (!selectedFriend.value) return
  remarkEditVal.value = String(selectedFriend.value.payload.remark || '')
  isEditingRemark.value = true
}

async function startEditTag() {
  if (!selectedFriend.value) return
  tagEditVal.value = String(selectedFriend.value.payload.groupTag || '')
  isEditingTag.value = true
}

async function handleDeleteFriend() {
  if (!selectedFriendId.value || !authStore.userUuid) return
  if (confirm('确定要删除该好友吗？此操作不可撤销。')) {
    const peerUuid = selectedFriendId.value
    try {
      await friendStore.removeFriend(authStore.userUuid, peerUuid)
      await sessionStore.deleteConv(buildP2PConversationId(authStore.userUuid, peerUuid))
      selectedFriendId.value = ''
      toast.success('好友已成功删除')
    } catch (error) {
      toast.error('删除好友失败，请重试')
    }
  }
}

// Redirect to chat
async function startChat(uuid: string, convType: number) {
  if (!authStore.userUuid) {
    toast.error('无法发起聊天：当前登录状态未就绪')
    return
  }

  try {
    await sessionStore.bootstrap(authStore.userUuid)
    await sessionStore.startConversation(uuid, convType)
    await router.push('/')
  } catch (error) {
    console.error('Failed to open chat from Contact:', error)
    toast.error('无法发起聊天：' + normalizeErrorMessage(error))
  }
}

// Apply approvals
async function handleApplyRequest(action: 1 | 2) {
  if (!selectedApplyId.value || !authStore.userUuid) return
  try {
    await applyStore.handleApplyAction(authStore.userUuid, selectedApplyId.value, action, applyRemarks.value)
    applyRemarks.value = ''
    // Refresh friend lists if approved
    if (action === 1) {
      await friendStore.syncFromServer(authStore.userUuid)
      toast.success('已成功同意好友申请')
    } else {
      toast.success('已拒绝该好友申请')
    }
  } catch (error) {
    toast.error('处理申请失败，请重试')
  }
}

// Resend Apply
async function handleResendApply() {
  if (!selectedApplyId.value || !authStore.userUuid) return
  try {
    const reason = prompt('请输入重新发送的附言理由 (可选):')
    if (reason === null) return
    await applyStore.retrySentApply(authStore.userUuid, selectedApplyId.value, reason)
    toast.success('好友申请已重新发送成功！')
  } catch (error) {
    toast.error('重新发送申请失败，请重试')
  }
}

// Group Details Actions
async function loadGroupDetails(groupUuid: string) {
  selectedGroupId.value = groupUuid
  isEditingNotice.value = false
  isEditingMyNickname.value = false
  await groupStore.selectGroup(groupUuid)
  
  // Find current member card nickname
  const me = groupStore.activeMembers.find(m => m.userUuid === authStore.userUuid)
  myGroupNickname.value = me?.groupNickname || ''

  // Sync pending join requests if user is admin or owner
  if (isAdminOrOwnerOfGroup.value) {
    await groupStore.syncJoinRequestsForGroup(groupUuid)
  }
}

const isAdminOrOwnerOfGroup = computed(() => {
  if (!selectedGroup.value) return false
  const isOwner = selectedGroup.value.ownerUuid === authStore.userUuid
  const me = groupStore.activeMembers.find(m => m.userUuid === authStore.userUuid)
  const isAdmin = me && me.role === 1
  return isOwner || isAdmin
})

const isGroupOwner = computed(() => {
  return selectedGroup.value?.ownerUuid === authStore.userUuid
})

async function saveGroupNotice() {
  if (!selectedGroupId.value) return
  try {
    await groupStore.updateNotice(selectedGroupId.value, groupNoticeText.value)
    isEditingNotice.value = false
    toast.success('群公告已成功更新')
  } catch (e) {
    toast.error('保存群公告失败，请重试')
  }
}

function startEditNotice() {
  groupNoticeText.value = selectedGroup.value?.notice || ''
  isEditingNotice.value = true
}

async function saveMyGroupNickname() {
  if (!selectedGroupId.value) return
  try {
    await groupStore.updateMyCard(selectedGroupId.value, myGroupNickname.value)
    isEditingMyNickname.value = false
    await groupStore.syncMembers(selectedGroupId.value)
    toast.success('群名片已成功更新')
  } catch (e) {
    toast.error('更新群名片失败，请重试')
  }
}

async function handleGroupQuitOrDissolve() {
  if (!selectedGroup.value) return
  const isOwner = selectedGroup.value.ownerUuid === authStore.userUuid
  const msg = isOwner ? '确定要解散该群聊吗？所有群消息将被清空。' : '确定要退出该群聊吗？'
  
  if (confirm(msg)) {
    try {
      if (isOwner) {
        const groupUuid = selectedGroup.value.groupUuid
        await groupStore.dissolveGroup(groupUuid)
        await sessionStore.deleteConv(groupUuid)
        toast.success('群聊已成功解散')
      } else {
        const groupUuid = selectedGroup.value.groupUuid
        await groupStore.quitGroup(groupUuid)
        await sessionStore.deleteConv(groupUuid)
        toast.success('已成功退出该群聊')
      }
      selectedGroupId.value = ''
    } catch (e) {
      toast.error('操作失败，请重试')
    }
  }
}

// Group Join Requests Modal Actions & State
const showGroupJoinRequestsModal = ref(false)
const groupReviewRemark = ref('')

async function openGroupJoinRequestsModal() {
  if (!selectedGroupId.value) return
  await groupStore.syncJoinRequestsForGroup(selectedGroupId.value)
  showGroupJoinRequestsModal.value = true
}

async function handleGroupReviewRequest(applyId: string | number, action: number) {
  if (!selectedGroupId.value) return
  try {
    await groupStore.reviewRequest(selectedGroupId.value, applyId, action, groupReviewRemark.value)
    groupReviewRemark.value = ''
    if (action === 1) {
      toast.success('已成功同意加群申请')
    } else {
      toast.success('已拒绝该加群申请')
    }
  } catch (e) {
    toast.error('审批操作失败，请重试')
  }
}

// Blacklist Action
async function handleRemoveFromBlacklist() {
  if (!selectedBlacklistId.value) return
  if (confirm('确定要将该用户移出黑名单吗？')) {
    try {
      await blacklistStore.removeFromBlacklist(authStore.userUuid, selectedBlacklistId.value)
      selectedBlacklistId.value = ''
      toast.success('用户已成功移出黑名单')
    } catch (error) {
      toast.error('操作失败，请重试')
    }
  }
}

</script>

<template>
  <div class="contact-layout">
    <!-- Category Subnav (Leftmost Panel) -->
    <div class="category-panel">
      <div class="brand-header">
        <h2>通讯录</h2>
      </div>

      <nav class="cat-menu">
        <button
          class="cat-item"
          :class="{ 'cat-item--active': activeTab === 'friends' }"
          @click="handleTabChange('friends')"
        >
          <User :size="18" class="cat-icon" />
          <span>我的好友</span>
          <span class="cat-count">{{ friends.length }}</span>
        </button>

        <button
          class="cat-item"
          :class="{ 'cat-item--active': activeTab === 'applies' }"
          @click="handleTabChange('applies')"
        >
          <UserPlus :size="18" class="cat-icon" />
          <span>好友申请</span>
          <span v-if="unreadCount > 0" class="badge-count animate-pulse">
            {{ unreadCount }}
          </span>
        </button>

        <button
          class="cat-item"
          :class="{ 'cat-item--active': activeTab === 'groups' }"
          @click="handleTabChange('groups')"
        >
          <Users :size="18" class="cat-icon" />
          <span>群聊目录</span>
          <span class="cat-count">{{ groups.length }}</span>
        </button>

        <button
          class="cat-item"
          :class="{ 'cat-item--active': activeTab === 'blacklist' }"
          @click="handleTabChange('blacklist')"
        >
          <ShieldAlert :size="18" class="cat-icon" />
          <span>黑名单</span>
          <span class="cat-count">{{ blacklistItems.length }}</span>
        </button>
      </nav>
    </div>

    <!-- Items List Pane (Middle Panel) -->
    <div class="list-panel">
      <!-- Header with sub-tabs for applications -->
      <div class="list-header" :class="{ 'list-header--applies': activeTab === 'applies' }">
        <div v-if="activeTab === 'applies'" class="apply-tabs">
          <button
            class="apply-tab"
            :class="{ 'apply-tab--active': applySubTab === 'inbox' }"
            @click="applySubTab = 'inbox'; selectedApplyId = null"
          >
            收到的申请
          </button>
          <button
            class="apply-tab"
            :class="{ 'apply-tab--active': applySubTab === 'sent' }"
            @click="applySubTab = 'sent'; selectedApplyId = null"
          >
            发出的申请
          </button>
        </div>
        <div v-else class="normal-header">
          <h3>
            <span v-if="activeTab === 'friends'">好友列表</span>
            <span v-else-if="activeTab === 'groups'">加入的群聊</span>
            <span v-else-if="activeTab === 'blacklist'">禁用的关系</span>
          </h3>
        </div>

        <div class="search-box">
          <Search :size="14" class="search-icon" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="快捷搜索名称、ID..."
            class="search-input"
          />
        </div>
      </div>

      <!-- Scrollable Cards Box -->
      <div class="list-body scrollbar-thin">
        <template v-if="loading">
          <SkeletonLoader type="contact" :count="4" />
        </template>
        <template v-else-if="activeTab === 'friends'">
          <div v-if="filteredFriends.length === 0" class="no-items">
            没有匹配的好友
          </div>
          <button
            v-for="friend in filteredFriends"
            :key="friend.peerUuid"
            class="list-card"
            :class="{ 'list-card--active': selectedFriendId === friend.peerUuid }"
            @click="selectedFriendId = friend.peerUuid"
          >
            <div class="card-avatar-wrapper">
              <img
                v-if="friend.payload.avatar"
                :src="friend.payload.avatar as string"
                class="card-avatar"
                alt="Avatar"
              />
              <div v-else class="card-avatar-placeholder">
                {{ String(friend.payload.remark || friend.payload.nickname || 'F').slice(0,1).toUpperCase() }}
              </div>
              <span
                class="presence-dot"
                :class="{ 'presence-dot--online': statusByUserUuid[friend.peerUuid]?.isOnline }"
              />
            </div>
            <div class="card-meta">
              <div class="card-title-row">
                <span class="card-title">{{ friend.payload.remark || friend.payload.nickname || friend.peerUuid }}</span>
                <span v-if="friend.payload.groupTag" class="tag-pill">{{ friend.payload.groupTag }}</span>
              </div>
              <p class="card-desc">{{ friend.payload.signature || '这个人很懒，什么都没写' }}</p>
            </div>
          </button>
        </template>
        <template v-else-if="activeTab === 'applies'">
          <div v-if="filteredApplies.length === 0" class="no-items">
            暂无申请记录
          </div>
          <button
            v-for="apply in filteredApplies"
            :key="apply.applyId"
            class="list-card"
            :class="{ 'list-card--active': selectedApplyId === apply.applyId }"
            @click="selectedApplyId = apply.applyId"
          >
            <div class="card-avatar-wrapper">
              <img
                v-if="apply.payload.applicantAvatar || apply.payload.targetAvatar"
                :src="(apply.payload.applicantAvatar || apply.payload.targetAvatar) as string"
                class="card-avatar"
                alt="Avatar"
              />
              <div v-else class="card-avatar-placeholder bg-emerald-500/10 text-emerald-500">
                A
              </div>
            </div>
            <div class="card-meta">
              <div class="card-title-row">
                <span class="card-title">
                  {{ apply.payload.applicantNickname || apply.payload.targetNickname || '用户申请' }}
                </span>
                <span
                  class="status-badge"
                  :class="{
                    'status-badge--pending': apply.status === 0,
                    'status-badge--accepted': apply.status === 1,
                    'status-badge--rejected': apply.status === 2
                  }"
                >
                  {{ apply.status === 0 ? '待处理' : apply.status === 1 ? '已同意' : '已拒绝' }}
                </span>
              </div>
              <p class="card-desc">{{ apply.payload.reason || '无申请备注' }}</p>
            </div>
          </button>
        </template>
        <template v-else-if="activeTab === 'groups'">
          <div v-if="filteredGroups.length === 0" class="no-items">
            没有匹配的群聊
          </div>
          <button
            v-for="group in filteredGroups"
            :key="group.groupUuid"
            class="list-card"
            :class="{ 'list-card--active': selectedGroupId === group.groupUuid }"
            @click="loadGroupDetails(group.groupUuid)"
          >
            <div class="card-avatar-wrapper">
              <img
                v-if="group.avatar"
                :src="group.avatar"
                class="card-avatar"
                alt="Group Avatar"
              />
              <div v-else class="card-avatar-placeholder bg-teal-500/10 text-teal-400">
                GP
              </div>
            </div>
            <div class="card-meta">
              <div class="card-title-row">
                <span class="card-title">{{ group.name }}</span>
                <span class="member-badge">{{ group.memberCount || 0 }}人</span>
              </div>
              <p class="card-desc">{{ group.notice || '暂无群公告' }}</p>
            </div>
          </button>
        </template>
        <template v-else-if="activeTab === 'blacklist'">
          <div v-if="filteredBlacklist.length === 0" class="no-items">
            黑名单为空
          </div>
          <button
            v-for="blackItem in filteredBlacklist"
            :key="blackItem.peerUuid"
            class="list-card"
            :class="{ 'list-card--active': selectedBlacklistId === blackItem.peerUuid }"
            @click="selectedBlacklistId = blackItem.peerUuid"
          >
            <div class="card-avatar-wrapper">
              <img
                v-if="blackItem.payload.avatar"
                :src="blackItem.payload.avatar as string"
                class="card-avatar"
                alt="Avatar"
              />
              <div v-else class="card-avatar-placeholder bg-rose-500/10 text-rose-500">
                B
              </div>
            </div>
            <div class="card-meta">
              <div class="card-title-row">
                <span class="card-title">{{ blackItem.payload.nickname || blackItem.peerUuid }}</span>
              </div>
              <p class="card-desc text-rose-500/70">已被您拉黑并屏蔽消息</p>
            </div>
          </button>
        </template>
      </div>
    </div>

    <!-- Details View Canvas (Right Panel) -->
    <div class="canvas-panel">
      <!-- Splash Empty State -->
      <div
        v-if="
          (activeTab === 'friends' && !selectedFriend) ||
          (activeTab === 'applies' && !selectedApply) ||
          (activeTab === 'groups' && !selectedGroup) ||
          (activeTab === 'blacklist' && !selectedBlacklistedUser)
        "
        class="empty-splash"
      >
        <div class="empty-glow" />
        <Compass :size="48" class="splash-icon animate-spin-slow" />
        <h4>选择卡片以查看详情</h4>
        <p>支持即时编辑备注、群公告、快速管理审批关系</p>
      </div>

      <!-- Details Details Cards -->
      <div v-else class="canvas-inner scrollbar-thin">
        <!-- 1. Friend Profile Details Card -->
        <div v-if="activeTab === 'friends' && selectedFriend" class="profile-card">
          <!-- Glass header -->
          <div class="profile-hero">
            <div class="avatar-glowing-ring">
              <img
                v-if="selectedFriend.payload.avatar"
                :src="selectedFriend.payload.avatar as string"
                class="profile-avatar"
                alt="Avatar"
              />
              <div v-else class="profile-avatar-placeholder">
                {{ String(selectedFriend.payload.remark || selectedFriend.payload.nickname || 'U').slice(0,1).toUpperCase() }}
              </div>
              <span
                class="status-ring"
                :class="{ 'status-ring--online': statusByUserUuid[selectedFriend.peerUuid]?.isOnline }"
              />
            </div>
            
            <div class="profile-names">
              <h2>{{ selectedFriend.payload.remark || selectedFriend.payload.nickname || '神秘好友' }}</h2>
              <p v-if="selectedFriend.payload.remark" class="original-nick">昵称: {{ selectedFriend.payload.nickname }}</p>
              <div class="presence-tag" :class="{ 'presence-tag--online': statusByUserUuid[selectedFriend.peerUuid]?.isOnline }">
                {{ statusByUserUuid[selectedFriend.peerUuid]?.isOnline ? '当前在线' : '离线/隐身' }}
              </div>
            </div>
          </div>

          <!-- Fields box -->
          <div class="info-section">
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">唯一账号 (UUID)</span>
                <div class="uuid-row">
                  <code class="uuid-code">{{ selectedFriend.peerUuid }}</code>
                  <button
                    class="btn-icon"
                    title="复制账号"
                    @click="copyToClipboard(selectedFriend.peerUuid)"
                  >
                    <Check v-if="isCopied && copiedId === selectedFriend.peerUuid" :size="14" class="text-emerald-500" />
                    <Copy v-else :size="14" />
                  </button>
                </div>
              </div>

              <div class="info-item">
                <span class="info-label">个性签名</span>
                <p class="signature-text">"{{ selectedFriend.payload.signature || '这家伙什么也没写。' }}"</p>
              </div>

              <!-- Inline Edits Remark -->
              <div class="info-item border-t border-white/5 pt-4">
                <span class="info-label">好友备注</span>
                <div v-if="!isEditingRemark" class="edit-display">
                  <span class="value-text">{{ selectedFriend.payload.remark || '(未设置备注)' }}</span>
                  <button class="btn-text-edit" @click="startEditRemark">
                    <Edit3 :size="14" />
                    修改
                  </button>
                </div>
                <div v-else class="edit-form">
                  <input
                    v-model="remarkEditVal"
                    type="text"
                    maxlength="20"
                    placeholder="输入新备注..."
                    class="glass-input"
                  />
                  <div class="edit-actions">
                    <button class="btn-confirm" @click="saveFriendRemark">保存</button>
                    <button class="btn-cancel" @click="isEditingRemark = false">取消</button>
                  </div>
                </div>
              </div>

              <!-- Inline Edits Tag -->
              <div class="info-item">
                <span class="info-label">关系分组标签</span>
                <div v-if="!isEditingTag" class="edit-display">
                  <span class="value-text">{{ selectedFriend.payload.groupTag || '(未分组)' }}</span>
                  <button class="btn-text-edit" @click="startEditTag">
                    <Edit3 :size="14" />
                    分组
                  </button>
                </div>
                <div v-else class="edit-form">
                  <input
                    v-model="tagEditVal"
                    type="text"
                    maxlength="15"
                    placeholder="输入或选择分组标签..."
                    class="glass-input"
                  />
                  <div class="tag-suggestions-row">
                    <button
                      v-for="tag in tagSuggestions"
                      :key="tag.tagName"
                      class="tag-suggestion-pill"
                      @click="applyQuickTag(tag.tagName)"
                    >
                      {{ tag.tagName }}
                    </button>
                  </div>
                  <div class="edit-actions">
                    <button class="btn-confirm" @click="saveFriendTag">保存</button>
                    <button class="btn-cancel" @click="isEditingTag = false">取消</button>
                  </div>
                </div>
              </div>

              <div class="info-item flex justify-between items-center text-xs text-[var(--c-text-muted)] border-t border-white/5 pt-4">
                <span>添加时间: {{ new Date(selectedFriend.payload.createdAt as number || Date.now()).toLocaleDateString() }}</span>
                <span>来源: {{ selectedFriend.payload.source || '搜索查找' }}</span>
              </div>
            </div>

            <!-- Big core actions -->
            <div class="profile-actions">
              <button class="btn-chat-primary" @click="startChat(selectedFriend.peerUuid, 1)">
                <MessageSquare :size="18" />
                发起实时聊天
              </button>
              <button class="btn-delete-danger" @click="handleDeleteFriend">
                <Trash2 :size="16" />
                删除好友
              </button>
            </div>
          </div>
        </div>

        <!-- 2. Group Details Card -->
        <div v-else-if="activeTab === 'groups' && selectedGroup" class="profile-card">
          <div class="profile-hero bg-gradient-to-r from-teal-500/10 to-transparent">
            <div class="avatar-glowing-ring avatar-glowing-ring--group">
              <img
                v-if="selectedGroup.avatar"
                :src="selectedGroup.avatar"
                class="profile-avatar"
                alt="Group Avatar"
              />
              <div v-else class="profile-avatar-placeholder text-teal-400">
                {{ selectedGroup.name.slice(0,2).toUpperCase() }}
              </div>
            </div>
            
            <div class="profile-names">
              <h2>{{ selectedGroup.name }}</h2>
              <div class="presence-tag presence-tag--group">
                群成员: {{ selectedGroup.memberCount }} 人
              </div>
            </div>
          </div>

          <div class="info-section">
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">群 UUID</span>
                <div class="uuid-row">
                  <code class="uuid-code">{{ selectedGroup.groupUuid }}</code>
                  <button
                    class="btn-icon"
                    title="复制群UUID"
                    @click="copyToClipboard(selectedGroup.groupUuid)"
                  >
                    <Check v-if="isCopied && copiedId === selectedGroup.groupUuid" :size="14" class="text-emerald-500" />
                    <Copy v-else :size="14" />
                  </button>
                </div>
              </div>

              <!-- Group Notice Editor -->
              <div class="info-item border-t border-white/5 pt-4">
                <span class="info-label">群公告</span>
                <div v-if="!isEditingNotice" class="edit-display flex-col items-start gap-2">
                  <p class="notice-block scrollbar-thin">{{ selectedGroup.notice || '当前没有任何群公告' }}</p>
                  <button
                    v-if="isAdminOrOwnerOfGroup"
                    class="btn-text-edit mt-1 self-end"
                    @click="startEditNotice"
                  >
                    <Edit3 :size="14" />
                    修改群公告
                  </button>
                </div>
                <div v-else class="edit-form w-full">
                  <textarea
                    v-model="groupNoticeText"
                    rows="3"
                    placeholder="输入新的群公告内容..."
                    class="glass-textarea"
                  />
                  <div class="edit-actions">
                    <button class="btn-confirm" @click="saveGroupNotice">保存</button>
                    <button class="btn-cancel" @click="isEditingNotice = false">取消</button>
                  </div>
                </div>
              </div>

              <!-- My Nickname inside Group -->
              <div class="info-item border-t border-white/5 pt-4">
                <span class="info-label">我的群名片 (昵称)</span>
                <div v-if="!isEditingMyNickname" class="edit-display">
                  <span class="value-text">{{ myGroupNickname || '(未设置名片，显示用户昵称)' }}</span>
                  <button class="btn-text-edit" @click="isEditingMyNickname = true">
                    <Edit3 :size="14" />
                    修改名片
                  </button>
                </div>
                <div v-else class="edit-form">
                  <input
                    v-model="myGroupNickname"
                    type="text"
                    maxlength="15"
                    placeholder="输入群昵称..."
                    class="glass-input"
                  />
                  <div class="edit-actions">
                    <button class="btn-confirm" @click="saveMyGroupNickname">保存</button>
                    <button class="btn-cancel" @click="isEditingMyNickname = false">取消</button>
                  </div>
                </div>
              </div>

              <!-- Settings indicators -->
              <div class="info-item flex gap-4 text-xs text-[var(--c-text-muted)] border-t border-white/5 pt-4">
                <span class="flex items-center gap-1">
                  <VolumeX v-if="selectedGroup.muteAll" :size="14" class="text-rose-500" />
                  <Volume2 v-else :size="14" class="text-emerald-500" />
                  {{ selectedGroup.muteAll ? '全员禁言已开启' : '全员正常发言' }}
                </span>
                <span class="flex items-center gap-1">
                  <ShieldCheck :size="14" class="text-amber-500" />
                  角色: {{ isGroupOwner ? '群主' : isAdminOrOwnerOfGroup ? '管理员' : '普通群员' }}
                </span>
              </div>
            </div>

            <!-- Group details actions -->
            <div class="profile-actions">
              <button class="btn-chat-primary" @click="startChat(selectedGroup.groupUuid, 2)">
                <MessageSquare :size="18" />
                进入群聊讨论
              </button>
              <button 
                v-if="isAdminOrOwnerOfGroup"
                class="btn-chat-primary bg-emerald-600/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/20 relative"
                @click="openGroupJoinRequestsModal"
              >
                <ShieldCheck :size="18" />
                加群申请审批
                <span 
                  v-if="(groupStore.pendingRequestsCount[selectedGroupId] || 0) > 0" 
                  class="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse shadow-md"
                >
                  {{ groupStore.pendingRequestsCount[selectedGroupId] || 0 }}
                </span>
              </button>
              <button
                class="btn-delete-danger"
                :class="{ 'btn-delete-danger--dissolve': isGroupOwner }"
                @click="handleGroupQuitOrDissolve"
              >
                <Trash2 :size="16" />
                {{ isGroupOwner ? '解散群聊' : '退出群聊' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 3. Friend Request Details Card -->
        <div v-else-if="activeTab === 'applies' && selectedApply" class="profile-card">
          <div class="profile-hero bg-gradient-to-r from-emerald-500/10 to-transparent">
            <div class="avatar-glowing-ring">
              <img
                v-if="selectedApply.payload.applicantAvatar || selectedApply.payload.targetAvatar"
                :src="(selectedApply.payload.applicantAvatar || selectedApply.payload.targetAvatar) as string"
                class="profile-avatar"
                alt="Avatar"
              />
              <div v-else class="profile-avatar-placeholder">
                A
              </div>
            </div>
            
            <div class="profile-names">
              <h2>{{ selectedApply.payload.applicantNickname || selectedApply.payload.targetNickname || '好友关系申请' }}</h2>
              <p class="original-nick">申请ID: #{{ selectedApply.applyId }}</p>
              <div class="presence-tag" :class="{ 'presence-tag--online': selectedApply.status === 0 }">
                {{ selectedApply.status === 0 ? '待我处理审批' : selectedApply.status === 1 ? '已同意添加' : '已拒绝' }}
              </div>
            </div>
          </div>

          <div class="info-section">
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">
                  {{ applySubTab === 'inbox' ? '申请者 UUID' : '目标对象 UUID' }}
                </span>
                <div class="uuid-row">
                  <code class="uuid-code">
                    {{ selectedApply.payload.applicantUuid || selectedApply.payload.targetUuid }}
                  </code>
                  <button
                    class="btn-icon"
                    title="复制账号"
                    @click="copyToClipboard((selectedApply.payload.applicantUuid || selectedApply.payload.targetUuid || '') as string)"
                  >
                    <Check v-if="isCopied && (copiedId === selectedApply.payload.applicantUuid || copiedId === selectedApply.payload.targetUuid)" :size="14" class="text-emerald-500" />
                    <Copy v-else :size="14" />
                  </button>
                </div>
              </div>

              <div class="info-item">
                <span class="info-label">申请附言理由</span>
                <p class="reason-block">
                  "{{ selectedApply.payload.reason || '该用户没有留下任何附言。' }}"
                </p>
              </div>

              <div class="info-item border-t border-white/5 pt-4">
                <span class="info-label">来源渠道</span>
                <span class="value-text">{{ selectedApply.payload.source || '搜索查找' }}</span>
              </div>

              <!-- Decision Box (If Inbox and Pending) -->
              <div v-if="selectedApply.status === 0 && applySubTab === 'inbox'" class="approval-form border-t border-white/5 pt-4">
                <span class="info-label">设置好友备注 (可选)</span>
                <input
                  v-model="applyRemarks"
                  type="text"
                  placeholder="如: 张三-销售经理"
                  class="glass-input mb-4"
                />

                <div class="approval-buttons">
                  <button class="btn-approve" @click="handleApplyRequest(1)">
                    <CheckCircle :size="16" />
                    同意申请
                  </button>
                  <button class="btn-reject" @click="handleApplyRequest(2)">
                    <XCircle :size="16" />
                    拒绝申请
                  </button>
                </div>
              </div>

              <!-- If Outbox and Pending/Rejected -->
              <div v-else-if="applySubTab === 'sent' && selectedApply.status !== 1" class="approval-form border-t border-white/5 pt-4 text-center">
                <p class="text-xs text-[var(--c-text-muted)] mb-4">
                  该申请当前正等待对方同意，如果申请超时或被拒绝，您可以重新发起申请。
                </p>
                <button class="btn-chat-primary justify-center mx-auto" @click="handleResendApply">
                  <ExternalLink :size="16" />
                  重新发出申请
                </button>
              </div>

              <!-- Static timestamp -->
              <div class="info-item text-xs text-[var(--c-text-muted)] border-t border-white/5 pt-4">
                申请时间: {{ new Date(selectedApply.updatedAt || Date.now()).toLocaleString() }}
              </div>
            </div>
          </div>
        </div>

        <!-- 4. Blacklisted User Details Card -->
        <div v-else-if="activeTab === 'blacklist' && selectedBlacklistedUser" class="profile-card">
          <div class="profile-hero bg-gradient-to-r from-rose-500/10 to-transparent">
            <div class="avatar-glowing-ring avatar-glowing-ring--banned">
              <img
                v-if="selectedBlacklistedUser.payload.avatar"
                :src="selectedBlacklistedUser.payload.avatar as string"
                class="profile-avatar"
                alt="Avatar"
              />
              <div class="profile-avatar-placeholder text-rose-500">
                B
              </div>
            </div>
            
            <div class="profile-names">
              <h2>{{ selectedBlacklistedUser.payload.nickname || '已拉黑账号' }}</h2>
              <p class="original-nick">被禁时间: {{ new Date(selectedBlacklistedUser.updatedAt || Date.now()).toLocaleString() }}</p>
            </div>
          </div>

          <div class="info-section">
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">屏蔽对象 UUID</span>
                <div class="uuid-row">
                  <code class="uuid-code">{{ selectedBlacklistedUser.peerUuid }}</code>
                  <button
                    class="btn-icon"
                    title="复制账号"
                    @click="copyToClipboard(selectedBlacklistedUser.peerUuid)"
                  >
                    <Check v-if="isCopied && copiedId === selectedBlacklistedUser.peerUuid" :size="14" class="text-emerald-500" />
                    <Copy v-else :size="14" />
                  </button>
                </div>
              </div>

              <div class="info-item border-t border-white/5 pt-4">
                <span class="info-label">当前状态</span>
                <p class="text-xs text-rose-400">
                  您已经屏蔽了来自此用户的任何即时消息与群申请提示，该用户无法向您成功发送私聊消息。
                </p>
              </div>
            </div>

            <div class="profile-actions">
              <button class="btn-chat-primary justify-center bg-rose-600/20 text-rose-400 border border-rose-500/30 hover:bg-rose-600/30" @click="handleRemoveFromBlacklist">
                <ShieldCheck :size="16" />
                移出黑名单
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Group Join Requests Modal -->
    <div v-if="showGroupJoinRequestsModal && selectedGroup" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-[var(--c-bg-panel)] backdrop-blur-md rounded-3xl w-[500px] max-h-[600px] flex flex-col shadow-2xl overflow-hidden border border-white/10 animate-slideUp">
        <header class="p-5 border-b border-white/5 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <h4 class="font-bold text-white text-lg">加群申请审批</h4>
            <span class="text-xs text-[var(--c-text-muted)] font-medium">({{ selectedGroup.name }})</span>
          </div>
          <button class="text-[var(--c-text-muted)] hover:text-white cursor-pointer" @click="showGroupJoinRequestsModal = false">✕</button>
        </header>
        
        <div class="flex-1 p-5 overflow-y-auto space-y-4">
          <p v-if="!groupStore.joinRequests[selectedGroup?.groupUuid || ''] || (groupStore.joinRequests[selectedGroup?.groupUuid || '']?.length ?? 0) === 0" class="text-center text-[var(--c-text-muted)] text-sm py-12">
            暂无待处理的加群申请
          </p>
          
          <div 
            v-for="req in groupStore.joinRequests[selectedGroup?.groupUuid || ''] || []" 
            :key="req.applyId" 
            class="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center font-bold text-sm">
                  {{ req.nickname.substring(0, 1) }}
                </div>
                <div class="text-left">
                  <h5 class="text-white font-bold text-sm">{{ req.nickname }}</h5>
                  <p class="text-[10px] text-[var(--c-text-muted)]">UUID: {{ req.applicantUuid }}</p>
                </div>
              </div>
              <span class="text-[10px] text-[var(--c-text-muted)] font-medium">
                {{ new Date(req.createdAt).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', month: '2-digit', day: '2-digit' }) }}
              </span>
            </div>
            
            <div class="bg-white/5 p-3 rounded-xl border border-white/5 text-xs text-neutral-300 text-left">
              <span class="font-bold text-[var(--c-text-muted)] block mb-1">申请理由：</span>
              {{ req.reason || '未填写申请理由' }}
            </div>

            <!-- Review remark and action buttons -->
            <div class="flex items-center gap-3 pt-1">
              <input 
                v-model="groupReviewRemark" 
                type="text" 
                placeholder="填写审批备注 (可选)..." 
                class="flex-1 text-xs px-3 py-2 border border-white/10 rounded-xl outline-none focus:border-emerald-500 bg-white/5 text-white"
              />
              <div class="flex gap-2">
                <button 
                  class="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition cursor-pointer"
                  @click="handleGroupReviewRequest(req.applyId, 2)"
                >
                  拒绝
                </button>
                <button 
                  class="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
                  @click="handleGroupReviewRequest(req.applyId, 1)"
                >
                  同意
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <footer class="p-5 border-t border-white/5 flex justify-end bg-black/10">
          <button class="px-5 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold cursor-pointer" @click="showGroupJoinRequestsModal = false">关闭</button>
        </footer>
      </div>
    </div>
  </div>
</template>

<style scoped>
.contact-layout {
  display: flex;
  width: 100%;
  height: 100%;
  background: var(--c-bg-app);
  overflow: hidden;
  color: var(--c-text-main);
  animation: fadeIn 0.4s var(--ease-out);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* 1. Category Panel (Leftmost) */
.category-panel {
  width: 220px;
  min-width: 220px;
  background: rgba(255, 255, 255, 0.02);
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
  gap: 16px;
  backdrop-filter: var(--blur-xl);
  -webkit-backdrop-filter: var(--blur-xl);
}

.brand-header h2 {
  font-size: 16px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.85);
  margin: 0;
  padding: 8px;
}

.cat-menu {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cat-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  background: transparent;
  color: var(--c-text-sub);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  transition: all var(--duration-fast) var(--ease-out);
  position: relative;
}

.cat-item:hover {
  background: rgba(255, 255, 255, 0.04);
  color: #fff;
  transform: translateX(2px);
}

.cat-item--active {
  background: rgba(0, 198, 112, 0.08);
  border-color: rgba(0, 198, 112, 0.2);
  color: var(--c-primary) !important;
}

.cat-icon {
  flex-shrink: 0;
  transition: color var(--duration-fast);
}

.cat-item--active .cat-icon {
  color: var(--c-primary);
}

.cat-count {
  margin-left: auto;
  font-size: 11px;
  background: rgba(255, 255, 255, 0.05);
  padding: 2px 6px;
  border-radius: var(--radius-full);
  color: var(--c-text-muted);
}

.badge-count {
  margin-left: auto;
  font-size: 11px;
  font-weight: bold;
  background: var(--c-danger);
  color: #fff;
  padding: 2px 6px;
  border-radius: var(--radius-full);
  box-shadow: 0 2px 6px rgba(255, 77, 79, 0.4);
}

/* 2. Items List Panel (Middle) */
.list-panel {
  width: 320px;
  min-width: 320px;
  background: rgba(255, 255, 255, 0.01);
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  backdrop-filter: var(--blur-lg);
  -webkit-backdrop-filter: var(--blur-lg);
}

.list-header {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.normal-header h3 {
  font-size: 14px;
  font-weight: 700;
  margin: 0;
  color: #fff;
}

/* Apply Sub-tabs */
.apply-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: rgba(0, 0, 0, 0.2);
  border-radius: var(--radius-md);
  padding: 3px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.apply-tab {
  border: none;
  background: transparent;
  padding: 6px;
  font-size: 12px;
  font-weight: 600;
  border-radius: var(--radius-sm);
  color: var(--c-text-muted);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.apply-tab--active {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

/* Search Box */
.search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 10px;
  color: var(--c-text-muted);
}

.search-input {
  width: 100%;
  background: rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-md);
  padding: 8px 12px 8px 30px;
  color: #fff;
  font-size: 12px;
  outline: none;
  transition: all var(--duration-fast);
}

.search-input:focus {
  border-color: var(--c-primary-soft);
  box-shadow: 0 0 0 2px rgba(0, 198, 112, 0.1);
  background: rgba(0, 0, 0, 0.25);
}

/* Scrollable Cards */
.list-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.no-items {
  text-align: center;
  padding: 32px;
  color: var(--c-text-muted);
  font-size: 12px;
}

/* List Card */
.list-card {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border-radius: var(--radius-lg);
  background: transparent;
  border: 1px solid transparent;
  cursor: pointer;
  text-align: left;
  transition: all var(--duration-fast) var(--ease-out);
}

.list-card:hover {
  background: rgba(255, 255, 255, 0.03);
  transform: translateY(-1px);
}

.list-card--active {
  background: rgba(0, 198, 112, 0.06) !important;
  border-color: rgba(0, 198, 112, 0.15);
}

.card-avatar-wrapper {
  position: relative;
  width: 42px;
  height: 42px;
  flex-shrink: 0;
}

.card-avatar {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-full);
  object-fit: cover;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.card-avatar-placeholder {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-full);
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 15px;
  background: var(--c-primary-soft);
  color: var(--c-primary);
}

.presence-dot {
  position: absolute;
  bottom: 0px;
  right: 0px;
  width: 10px;
  height: 10px;
  border-radius: var(--radius-full);
  background: #c3c9d2;
  border: 2px solid var(--c-bg-app);
}

.presence-dot--online {
  background: var(--c-success);
  box-shadow: 0 0 6px var(--c-success);
}

.card-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.card-title {
  font-size: 13px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.list-card--active .card-title {
  color: var(--c-primary);
}

.tag-pill {
  font-size: 10px;
  background: rgba(255, 255, 255, 0.08);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  color: var(--c-text-muted);
  flex-shrink: 0;
}

.member-badge {
  font-size: 10px;
  color: var(--c-primary);
  background: rgba(0, 198, 112, 0.1);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  font-weight: bold;
}

.status-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  font-weight: bold;
  flex-shrink: 0;
}

.status-badge--pending {
  background: rgba(240, 173, 78, 0.15);
  color: #f0ad4e;
}

.status-badge--accepted {
  background: rgba(92, 184, 92, 0.15);
  color: #5cb85c;
}

.status-badge--rejected {
  background: rgba(217, 83, 79, 0.15);
  color: #d9534f;
}

.card-desc {
  margin: 0;
  font-size: 11px;
  color: var(--c-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 3. Detail Pane (Right panel Canvas) */
.canvas-panel {
  flex: 1;
  min-width: 0;
  background: rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  position: relative;
}

/* Splash empty state */
.empty-splash {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--c-text-muted);
  text-align: center;
  padding: 32px;
  position: relative;
  overflow: hidden;
}

.empty-glow {
  position: absolute;
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(0, 198, 112, 0.05) 0%, transparent 70%);
  z-index: 0;
}

.splash-icon {
  margin-bottom: 16px;
  color: rgba(255, 255, 255, 0.1);
  z-index: 1;
}

.empty-splash h4 {
  font-size: 16px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.7);
  margin: 0 0 8px 0;
  z-index: 1;
}

.empty-splash p {
  font-size: 12px;
  margin: 0;
  z-index: 1;
  max-width: 240px;
}

.animate-spin-slow {
  animation: spin 12s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Canvas Details Inner */
.canvas-inner {
  flex: 1;
  overflow-y: auto;
  padding: 32px 24px;
}

.profile-card {
  max-width: 680px;
  margin: 0 auto;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: var(--radius-2xl);
  backdrop-filter: var(--blur-2xl);
  -webkit-backdrop-filter: var(--blur-2xl);
  overflow: hidden;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.4s var(--ease-out);
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Profile Hero */
.profile-hero {
  padding: 32px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  gap: 24px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.02) 0%, transparent 100%);
}

.avatar-glowing-ring {
  width: 80px;
  height: 80px;
  position: relative;
  border-radius: var(--radius-full);
  padding: 4px;
  background: linear-gradient(135deg, rgba(0, 198, 112, 0.2) 0%, transparent 100%);
  box-shadow: 0 8px 24px rgba(0, 198, 112, 0.15);
}

.avatar-glowing-ring--group {
  background: linear-gradient(135deg, rgba(20, 184, 166, 0.2) 0%, transparent 100%);
  box-shadow: 0 8px 24px rgba(20, 184, 166, 0.15);
}

.avatar-glowing-ring--banned {
  background: linear-gradient(135deg, rgba(244, 63, 94, 0.2) 0%, transparent 100%);
  box-shadow: 0 8px 24px rgba(244, 63, 94, 0.15);
}

.profile-avatar {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-full);
  object-fit: cover;
  border: 2px solid rgba(255, 255, 255, 0.2);
}

.profile-avatar-placeholder {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.05);
  display: grid;
  place-items: center;
  font-size: 26px;
  font-weight: 800;
  color: var(--c-primary);
  border: 2px solid rgba(255, 255, 255, 0.2);
}

.status-ring {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 16px;
  height: 16px;
  border-radius: var(--radius-full);
  background: #c3c9d2;
  border: 3px solid var(--c-bg-app);
}

.status-ring--online {
  background: var(--c-success);
  box-shadow: 0 0 8px var(--c-success);
}

.profile-names h2 {
  font-size: 20px;
  font-weight: 800;
  margin: 0 0 4px 0;
  color: #fff;
}

.original-nick {
  font-size: 11px;
  color: var(--c-text-muted);
  margin: 0 0 6px 0;
}

.presence-tag {
  display: inline-block;
  font-size: 11px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--c-text-muted);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-weight: bold;
}

.presence-tag--online {
  background: rgba(0, 198, 112, 0.1);
  color: var(--c-primary);
}

.presence-tag--group {
  background: rgba(20, 184, 166, 0.1);
  color: #14b8a6;
}

/* Info Sections */
.info-section {
  padding: 24px;
}

.info-grid {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--c-text-muted);
  font-weight: 700;
}

/* UUID Row */
.uuid-row {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(0, 0, 0, 0.2);
  padding: 6px 12px;
  border-radius: var(--radius-md);
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.uuid-code {
  font-family: monospace;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  word-break: break-all;
  flex: 1;
}

.btn-icon {
  background: transparent;
  border: none;
  color: var(--c-text-muted);
  cursor: pointer;
  display: grid;
  place-items: center;
  padding: 4px;
  border-radius: var(--radius-sm);
  transition: all var(--duration-fast);
}

.btn-icon:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}

.signature-text {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  font-style: italic;
  margin: 0;
  padding: 4px 0;
}

.reason-block,
.notice-block {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
  background: rgba(0, 0, 0, 0.15);
  padding: 12px;
  border-radius: var(--radius-md);
  border-left: 3px solid var(--c-primary);
  margin: 4px 0;
  line-height: 1.6;
  white-space: pre-wrap;
}

.notice-block {
  max-height: 120px;
  overflow-y: auto;
  border-left-color: #14b8a6;
}

/* Display & Inline Edits */
.edit-display {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.value-text {
  font-size: 13px;
  color: #fff;
  font-weight: 600;
}

.btn-text-edit {
  background: transparent;
  border: none;
  color: var(--c-primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  transition: all var(--duration-fast);
}

.btn-text-edit:hover {
  background: rgba(0, 198, 112, 0.1);
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.glass-input {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-md);
  padding: 8px 12px;
  color: #fff;
  font-size: 13px;
  outline: none;
  transition: all var(--duration-fast);
}

.glass-input:focus,
.glass-textarea:focus {
  border-color: var(--c-primary-soft);
  box-shadow: 0 0 0 2px rgba(0, 198, 112, 0.1);
}

.glass-textarea {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-md);
  padding: 8px 12px;
  color: #fff;
  font-size: 13px;
  outline: none;
  resize: vertical;
  transition: all var(--duration-fast);
}

.edit-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.btn-confirm {
  background: var(--c-primary);
  border: none;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  padding: 6px 14px;
  border-radius: var(--radius-md);
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 198, 112, 0.3);
}

.btn-cancel {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--c-text-muted);
  font-size: 12px;
  font-weight: 600;
  padding: 5px 14px;
  border-radius: var(--radius-md);
  cursor: pointer;
}

/* Tag suggestions selection */
.tag-suggestions-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.tag-suggestion-pill {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-full);
  padding: 2px 10px;
  font-size: 11px;
  color: var(--c-text-sub);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.tag-suggestion-pill:hover {
  background: rgba(0, 198, 112, 0.1);
  border-color: rgba(0, 198, 112, 0.2);
  color: var(--c-primary);
}

/* Profile Big Actions */
.profile-actions {
  display: flex;
  gap: 12px;
  margin-top: 36px;
  border-t: 1px solid rgba(255, 255, 255, 0.05);
  padding-top: 24px;
}

.btn-chat-primary {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: linear-gradient(135deg, #00E583 0%, #00C670 100%);
  border: none;
  color: #fff;
  font-weight: 700;
  font-size: 14px;
  padding: 12px 20px;
  border-radius: var(--radius-lg);
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0, 198, 112, 0.3);
  transition: all var(--duration-fast) var(--ease-out);
}

.btn-chat-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 198, 112, 0.4);
}

.btn-delete-danger {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 77, 79, 0.08);
  border: 1px solid rgba(255, 77, 79, 0.2);
  color: #ff4d4f;
  font-weight: 600;
  font-size: 13px;
  padding: 12px 18px;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.btn-delete-danger:hover {
  background: rgba(255, 77, 79, 0.15);
  border-color: rgba(255, 77, 79, 0.3);
}

.btn-delete-danger--dissolve {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.08);
  border-color: rgba(245, 158, 11, 0.2);
}

.btn-delete-danger--dissolve:hover {
  background: rgba(245, 158, 11, 0.15);
  border-color: rgba(245, 158, 11, 0.3);
}

/* Approval Form Buttons */
.approval-form {
  background: rgba(255, 255, 255, 0.01);
}

.approval-buttons {
  display: flex;
  gap: 12px;
}

.btn-approve {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #10b981;
  padding: 10px;
  border-radius: var(--radius-md);
  font-weight: 700;
  cursor: pointer;
  transition: all var(--duration-fast);
}

.btn-approve:hover {
  background: rgba(16, 185, 129, 0.25);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.1);
}

.btn-reject {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #ef4444;
  padding: 10px;
  border-radius: var(--radius-md);
  font-weight: 700;
  cursor: pointer;
  transition: all var(--duration-fast);
}

.btn-reject:hover {
  background: rgba(239, 68, 68, 0.2);
}

/* Utilities */
.scrollbar-thin::-webkit-scrollbar {
  width: 4px;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-full);
}
.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
