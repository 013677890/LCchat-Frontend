<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import ConversationPane from '../components/ConversationPane.vue'
import MessagePane from '../components/MessagePane.vue'
import { useSessionStore } from '../../../stores/session.store'
import { useGroupStore } from '../../../stores/group.store'
import { useFriendStore } from '../../../stores/friend.store'
import { useAuthStore } from '../../../stores/auth.store'
import { useUserStore } from '../../../stores/user.store'
import { useBlacklistStore } from '../../../stores/blacklist.store'
import { usePresenceStore } from '../../../stores/presence.store'
import { checkBlacklist } from '../../blacklist/api'
import { formatConversationTime } from '../../../shared/utils/time'
import { resolveAssetUrl } from '../../../shared/utils/asset-url'
import { appConfirm } from '../../../shared/composables/useConfirm'
import type { GroupMemberItemDTO } from '../../group/api'

const sessionStore = useSessionStore()
const groupStore = useGroupStore()
const friendStore = useFriendStore()
const authStore = useAuthStore()
const userStore = useUserStore()
const blacklistStore = useBlacklistStore()
const presenceStore = usePresenceStore()

const {
  conversations,
  activeConvId,
  activeConversation,
  activeMessages,
  activeDraft,
  loading,
  loadingOlderMessages,
  activeHasMoreBefore,
  localDBAvailable
} = storeToRefs(sessionStore)

const {
  activeGroup,
  activeMembers
} = storeToRefs(groupStore)

// Drawer State
const showDrawer = ref(false)
const showInviteModal = ref(false)
const showKickModal = ref(false)

// Edit State
const isEditingNotice = ref(false)
const noticeText = ref('')
const isEditingGroupName = ref(false)
const groupNameText = ref('')

// Friend Detail Cache
const friendRemark = ref('')
const friendTag = ref('')
const isBlacklisted = ref(false)

// Selection list for inviting friends
const inviteList = ref<string[]>([])
// Selection list for kicking members
const kickList = ref<string[]>([])

const activeConversationTitle = computed(() => {
  if (!activeConversation.value) return '会话'
  return sessionStore.getConversationTitle(activeConversation.value)
})

const isGroup = computed(() => {
  return activeConversation.value?.payload.convType === 2
})

const currentFriend = computed(() => {
  if (isGroup.value || !activeConversation.value) return null
  const targetUuid = activeConversation.value.payload.targetUuid as string
  return friendStore.friends.find(f => f.peerUuid === targetUuid) || null
})

// Current User's Role in Group: 0=normal, 1=admin, 2=owner
const currentUserGroupRole = computed(() => {
  if (!isGroup.value || !activeGroup.value) return 0
  if (activeGroup.value.ownerUuid === authStore.userUuid) return 2
  const member = activeMembers.value.find(m => m.userUuid === authStore.userUuid)
  return member?.role === 1 ? 1 : 0
})

const canManageGroup = computed(() => {
  return currentUserGroupRole.value >= 1
})

// 对端已读位点（仅单聊）：来自 MSG_READ_RECEIPT 推送，供 MessagePane 展示已读/未读。
const peerReadSeq = computed(() => {
  if (!activeConvId.value) return 0
  return sessionStore.peerReadSeqByConversation[activeConvId.value] ?? 0
})

// ------ 会话列表项组装（含头像与群标识） ------
const conversationItems = computed(() => {
  const friendAvatarByUuid = new Map<string, string>()
  for (const friend of friendStore.friends) {
    friendAvatarByUuid.set(friend.peerUuid, (friend.payload.avatar as string) || '')
  }
  const groupAvatarByUuid = new Map<string, string>()
  for (const group of groupStore.groups) {
    groupAvatarByUuid.set(group.groupUuid, group.avatar ? resolveAssetUrl(group.avatar) : '')
  }

  return conversations.value.map(c => {
    const isGroupConv = Number(c.payload.convType) === 2
    const targetUuid = String(c.payload.targetUuid || '')
    return {
      convId: c.convId,
      title: sessionStore.getConversationTitle(c),
      preview: sessionStore.getConversationPreview(c),
      unread: sessionStore.getConversationUnread(c),
      timeText: c.updatedAt ? formatConversationTime(c.updatedAt) : '',
      mute: !!c.payload.mute,
      pin: !!c.payload.pin,
      avatar: isGroupConv
        ? groupAvatarByUuid.get(targetUuid) || ''
        : friendAvatarByUuid.get(targetUuid) || '',
      isGroup: isGroupConv
    }
  })
})

// ------ 聊天区头像 ------
const selfAvatarUrl = computed(() =>
  resolveAssetUrl(userStore.profile?.payload?.avatar as string, { fallbackType: 'me' })
)

// 单聊对端头像（好友表里已归一化过），空则由 MessagePane 回退首字色块。
const peerAvatarUrl = computed(() => {
  if (isGroup.value || !activeConversation.value) return ''
  const targetUuid = activeConversation.value.payload.targetUuid as string
  const friend = friendStore.friends.find(f => f.peerUuid === targetUuid)
  return (friend?.payload.avatar as string) || ''
})

// 聊天头部头像：群聊用群头像，单聊用对端头像。
const conversationAvatarUrl = computed(() => {
  if (!activeConversation.value) return ''
  if (isGroup.value) {
    return activeGroup.value?.avatar ? resolveAssetUrl(activeGroup.value.avatar) : ''
  }
  return peerAvatarUrl.value
})

// ------ 单聊对端在线状态 ------
const PEER_PRESENCE_REFRESH_MS = 60000
let presenceTimer: ReturnType<typeof setInterval> | null = null

const activePeerUuid = computed(() => {
  if (isGroup.value || !activeConversation.value) return ''
  return (activeConversation.value.payload.targetUuid as string) || ''
})

const peerOnline = computed<boolean | null>(() => {
  if (!activePeerUuid.value) return null
  const status = presenceStore.getStatus(activePeerUuid.value)
  return status ? status.isOnline : null
})

// 切换到单聊会话时立即拉一次在线状态，之后周期刷新当前会话对端。
watch(
  activePeerUuid,
  (uuid) => {
    if (uuid) {
      void presenceStore.syncSingle(uuid)
    }
  },
  { immediate: true }
)

onMounted(() => {
  presenceTimer = setInterval(() => {
    if (activePeerUuid.value) {
      void presenceStore.syncSingle(activePeerUuid.value)
    }
  }, PEER_PRESENCE_REFRESH_MS)
})

onUnmounted(() => {
  if (presenceTimer) {
    clearInterval(presenceTimer)
    presenceTimer = null
  }
})

// Watch active conversation changes
watch(activeConversation, async (newVal) => {
  showDrawer.value = false
  isEditingNotice.value = false
  isEditingGroupName.value = false
  
  if (newVal) {
    const targetUuid = newVal.payload.targetUuid as string
    if (newVal.payload.convType === 2) {
      await groupStore.selectGroup(targetUuid)
      if (currentUserGroupRole.value >= 1) {
        await groupStore.syncJoinRequestsForGroup(targetUuid)
      }
    } else {
      // Fetch friend's details
      const friend = friendStore.friends.find(f => f.peerUuid === targetUuid)
      friendRemark.value = (friend?.payload.remark as string) || ''
      friendTag.value = (friend?.payload.groupTag as string) || ''
      
      try {
        const check = await checkBlacklist({ userUuid: authStore.userUuid, targetUuid })
        isBlacklisted.value = check.data.isBlacklist
      } catch (e) {
        isBlacklisted.value = false
      }
    }
  }
}, { immediate: true })

async function handleConversationSelect(convId: string) {
  await sessionStore.openConversation(convId)
}

async function handleDraftChange(value: string) {
  await sessionStore.setDraft(value)
}

async function handleSend(text: string) {
  await sessionStore.sendMessage(text)
}

async function handleLoadOlderMessages() {
  await sessionStore.loadOlderMessages()
}

// Group Details Drawer Actions
async function toggleMuteAll() {
  if (!activeGroup.value) return
  const currentSetting = activeGroup.value.muteAll
  try {
    await groupStore.updateMuteAll(activeGroup.value.groupUuid, !currentSetting)
    toast.success(!currentSetting ? '已开启全员禁言' : '已关闭全员禁言')
  } catch (err: any) {
    toast.error('设置全员禁言失败: ' + (err.message || '未知错误'))
  }
}

function startEditNotice() {
  if (!canManageGroup.value) return
  noticeText.value = activeGroup.value?.notice || ''
  isEditingNotice.value = true
}

async function saveNotice() {
  if (!activeGroup.value) return
  try {
    await groupStore.updateNotice(activeGroup.value.groupUuid, noticeText.value)
    isEditingNotice.value = false
    toast.success('群公告更新成功')
  } catch (err: any) {
    toast.error('保存群公告失败: ' + (err.message || '未知错误'))
  }
}

function startEditGroupName() {
  if (!canManageGroup.value) return
  groupNameText.value = activeGroup.value?.name || ''
  isEditingGroupName.value = true
}

async function saveGroupName() {
  if (!activeGroup.value) return
  try {
    await groupStore.updateInfo(activeGroup.value.groupUuid, groupNameText.value)
    isEditingGroupName.value = false
    toast.success('群名称修改成功')
  } catch (err: any) {
    toast.error('修改群名称失败: ' + (err.message || '未知错误'))
  }
}

// Add/Invite Members
function openInviteModal() {
  inviteList.value = []
  showInviteModal.value = true
}

const inviteableFriends = computed(() => {
  return friendStore.friends.filter(f => {
    // Friend is not already a member
    return !activeMembers.value.some(m => m.userUuid === f.peerUuid)
  })
})

async function submitInvite() {
  if (!activeGroup.value || inviteList.value.length === 0) return
  try {
    await groupStore.inviteMembers(activeGroup.value.groupUuid, inviteList.value)
    showInviteModal.value = false
    toast.success('群成员邀请已发送')
  } catch (err: any) {
    toast.error('邀请群成员失败: ' + (err.message || '未知错误'))
  }
}

// Kick Members
function openKickModal() {
  kickList.value = []
  showKickModal.value = true
}

const kickableMembers = computed(() => {
  return activeMembers.value.filter(m => {
    // Cannot kick self
    if (m.userUuid === authStore.userUuid) return false
    // Normal users cannot kick anyone, Admin can kick normals, Owner can kick anyone except owner
    if (currentUserGroupRole.value === 1) {
      return m.role === 0
    }
    return currentUserGroupRole.value === 2
  })
})

async function submitKick() {
  if (!activeGroup.value || kickList.value.length === 0) return
  try {
    for (const uid of kickList.value) {
      await groupStore.kickMember(activeGroup.value.groupUuid, uid)
    }
    showKickModal.value = false
    toast.success('已成功移除选定成员')
  } catch (err: any) {
    toast.error('移除成员失败: ' + (err.message || '未知错误'))
  }
}

// Group settings actions
async function handleLeaveGroup() {
  const group = activeGroup.value
  if (!group) return
  const convId = activeConvId.value
  const confirmed = await appConfirm({
    title: '退出群组',
    message: `确认退出「${group.name}」吗？退出后需要重新申请才能加入。`,
    confirmText: '退出群组',
    danger: true
  })
  if (!confirmed) return
  await groupStore.quitGroup(group.groupUuid)
  await sessionStore.deleteConv(convId)
}

async function handleDismissGroup() {
  const group = activeGroup.value
  if (!group) return
  const convId = activeConvId.value
  const confirmed = await appConfirm({
    title: '解散群组',
    message: `确认解散「${group.name}」吗？所有成员将被移出，此操作无法撤销。`,
    confirmText: '解散',
    danger: true
  })
  if (!confirmed) return
  await groupStore.dissolveGroup(group.groupUuid)
  await sessionStore.deleteConv(convId)
}

// Transfer owner
async function handleTransferOwner(targetUuid: string) {
  const group = activeGroup.value
  if (!group) return
  const confirmed = await appConfirm({
    title: '转让群主',
    message: '确认将群主转让给该成员吗？转让后你将变为普通成员。',
    confirmText: '转让'
  })
  if (!confirmed) return
  await groupStore.transferOwner(group.groupUuid, targetUuid)
}

// Friend Settings Actions
async function saveFriendRemark() {
  if (!currentFriend.value) return
  await friendStore.updateFriendRemark(authStore.userUuid, currentFriend.value.peerUuid, friendRemark.value)
}

async function saveFriendTag() {
  if (!currentFriend.value) return
  await friendStore.updateFriendTag(authStore.userUuid, currentFriend.value.peerUuid, friendTag.value)
}

async function toggleBlacklist() {
  if (!currentFriend.value) return
  try {
    if (isBlacklisted.value) {
      await blacklistStore.removeFromBlacklist(authStore.userUuid, currentFriend.value.peerUuid)
      isBlacklisted.value = false
    } else {
      await blacklistStore.addToBlacklist(authStore.userUuid, currentFriend.value.peerUuid, {
        nickname: String(currentFriend.value.payload.nickname || currentFriend.value.peerUuid),
        avatar: String(currentFriend.value.payload.avatar || '')
      })
      isBlacklisted.value = true
    }
  } catch (e) {
    console.error(e)
  }
}

async function handleDeleteFriend() {
  const friend = currentFriend.value
  if (!friend) return
  const convId = activeConvId.value
  const confirmed = await appConfirm({
    title: '删除好友',
    message: '确认删除该好友吗？将同时清除双方会话，此操作不可撤销。',
    confirmText: '删除',
    danger: true
  })
  if (!confirmed) return
  await friendStore.removeFriend(authStore.userUuid, friend.peerUuid)
  await sessionStore.deleteConv(convId)
}

async function handlePin(convId: string, pin: boolean) {
  await sessionStore.updateConvSettings(convId, { pin })
}

async function handleMute(convId: string, mute: boolean) {
  await sessionStore.updateConvSettings(convId, { mute })
}

async function handleDelete(convId: string) {
  const confirmed = await appConfirm({
    title: '删除会话',
    message: '确认删除该会话吗？删除后将无法恢复。',
    confirmText: '删除',
    danger: true
  })
  if (!confirmed) return
  await sessionStore.deleteConv(convId)
}

async function handleRecallMessage(msgId: string) {
  await sessionStore.recallMessage(msgId)
}

async function handleResendMessage(clientMsgId: string) {
  try {
    await sessionStore.resendMessage(clientMsgId)
  } catch (err: any) {
    toast.error('重试发送失败: ' + (err.message || '网络异常'))
  }
}

// Join Requests Modal State
const showJoinRequestsModal = ref(false)
const reviewRemark = ref('')

async function openJoinRequestsModal() {
  if (!activeGroup.value) return
  await groupStore.syncJoinRequestsForGroup(activeGroup.value.groupUuid)
  showJoinRequestsModal.value = true
}

async function handleReviewRequest(applyId: string | number, action: number) {
  if (!activeGroup.value) return
  try {
    await groupStore.reviewRequest(activeGroup.value.groupUuid, applyId, action, reviewRemark.value)
    reviewRemark.value = ''
    toast.success(action === 1 ? '已同意加群申请' : '已拒绝加群申请')
  } catch (err: any) {
    toast.error('审批申请失败: ' + (err.message || '未知错误'))
  }
}

// All Members Modal State
const showAllMembersModal = ref(false)
const memberSearchKeyword = ref('')

const filteredAllMembers = computed(() => {
  if (!memberSearchKeyword.value.trim()) return activeMembers.value
  const kw = memberSearchKeyword.value.toLowerCase()
  return activeMembers.value.filter(m => 
    m.nickname.toLowerCase().includes(kw) || 
    m.groupNickname?.toLowerCase().includes(kw) ||
    m.userUuid.includes(kw)
  )
})

// Member Detail & Management Modal State
const showMemberDetailModal = ref(false)
const selectedMember = ref<GroupMemberItemDTO | null>(null)

function openMemberDetail(member: GroupMemberItemDTO) {
  selectedMember.value = member
  showMemberDetailModal.value = true
}

const isMemberMuted = computed(() => {
  if (!selectedMember.value) return false
  return selectedMember.value.muteUntil > Date.now()
})

const memberMuteRemainingText = computed(() => {
  if (!selectedMember.value || !isMemberMuted.value) return ''
  const diffMs = selectedMember.value.muteUntil - Date.now()
  const diffMin = Math.ceil(diffMs / 60000)
  if (diffMin < 60) return `${diffMin} 分钟`
  const diffHours = Math.ceil(diffMin / 60)
  if (diffHours < 24) return `${diffHours} 小时`
  return `${Math.ceil(diffHours / 24)} 天`
})

const canManageSelectedMember = computed(() => {
  if (!activeGroup.value || !selectedMember.value) return false
  if (selectedMember.value.userUuid === authStore.userUuid) return false
  
  const myRole = currentUserGroupRole.value
  const targetRole = selectedMember.value.role
  
  if (myRole === 2) return true
  if (myRole === 1) {
    return targetRole === 0 && selectedMember.value.userUuid !== activeGroup.value.ownerUuid
  }
  return false
})

async function handleMuteMember(durationMs: number) {
  if (!activeGroup.value || !selectedMember.value) return
  try {
    await groupStore.muteMember(activeGroup.value.groupUuid, selectedMember.value.userUuid, durationMs)
    const updated = activeMembers.value.find(m => m.userUuid === selectedMember.value?.userUuid)
    if (updated) {
      selectedMember.value = updated
    }
    toast.success(durationMs > 0 ? '成员禁言设置成功' : '成员已解除禁言')
  } catch (err: any) {
    toast.error('禁言设置失败: ' + (err.message || '未知错误'))
  }
}

async function handleToggleAdminRole() {
  if (!activeGroup.value || !selectedMember.value) return
  const newRole = selectedMember.value.role === 1 ? 0 : 1
  try {
    await groupStore.updateRole(activeGroup.value.groupUuid, selectedMember.value.userUuid, newRole)
    const updated = activeMembers.value.find(m => m.userUuid === selectedMember.value?.userUuid)
    if (updated) {
      selectedMember.value = updated
    }
    toast.success(newRole === 1 ? '已成功设立为管理员' : '已成功取消管理员身份')
  } catch (err: any) {
    toast.error('角色设置失败: ' + (err.message || '未知错误'))
  }
}

async function handleKickSelectedMember() {
  const group = activeGroup.value
  const member = selectedMember.value
  if (!group || !member) return
  const confirmed = await appConfirm({
    title: '移出群组',
    message: `确认将成员「${member.groupNickname || member.nickname}」移出群组吗？`,
    confirmText: '移出',
    danger: true
  })
  if (!confirmed) return
  try {
    await groupStore.kickMember(group.groupUuid, member.userUuid)
    showMemberDetailModal.value = false
    selectedMember.value = null
    toast.success('成员已成功踢出')
  } catch (err: any) {
    toast.error('踢出群成员失败: ' + (err.message || '未知错误'))
  }
}

async function handleTransferOwnerSelectedMember() {
  const group = activeGroup.value
  const member = selectedMember.value
  if (!group || !member) return
  const confirmed = await appConfirm({
    title: '转让群主',
    message: `确认将群主转让给「${member.groupNickname || member.nickname}」吗？此操作无法撤销。`,
    confirmText: '转让',
    danger: true
  })
  if (!confirmed) return
  try {
    await groupStore.transferOwner(group.groupUuid, member.userUuid)
    showMemberDetailModal.value = false
    selectedMember.value = null
    toast.success('群主身份已成功转让')
  } catch (err: any) {
    toast.error('转让群主失败: ' + (err.message || '未知错误'))
  }
}
</script>

<template>
  <div class="flex h-full min-h-0 w-full overflow-hidden bg-gradient-to-tr from-[rgba(0,198,112,0.02)] to-[rgba(65,90,130,0.02)]">
    <!-- List Pane -->
    <aside class="w-[300px] min-w-[280px] xl:w-[320px] xl:min-w-[320px] flex flex-col bg-[var(--c-bg-panel)] h-full min-h-0 border-r border-white/10 backdrop-blur-xl">
      <ConversationPane
        :items="conversationItems"
        :active-conv-id="activeConvId"
        :loading="loading"
        :local-db-available="localDBAvailable"
        @select="handleConversationSelect"
        @pin="handlePin"
        @mute="handleMute"
        @delete="handleDelete"
      />
    </aside>

    <!-- Detail Pane -->
    <main class="flex-1 flex flex-col min-w-0 min-h-0 h-full relative overflow-hidden">
      <MessagePane
        v-if="activeConvId"
        :title="activeConversationTitle"
        :messages="activeMessages"
        :draft="activeDraft"
        :current-user-uuid="authStore.userUuid"
        :is-group="isGroup"
        :current-user-group-role="currentUserGroupRole"
        :group-members="activeMembers"
        :conv-id="activeConvId"
        :peer-read-seq="peerReadSeq"
        :conversation-avatar="conversationAvatarUrl"
        :peer-avatar="peerAvatarUrl"
        :self-avatar="selfAvatarUrl"
        :peer-online="peerOnline"
        :loading-older="loadingOlderMessages"
        :has-more-before="activeHasMoreBefore"
        @update:draft="handleDraftChange"
        @send="handleSend"
        @load-older-messages="handleLoadOlderMessages"
        @recall-message="handleRecallMessage"
        @resend-message="handleResendMessage"
      >
        <template #header-actions>
          <button 
            type="button" 
            class="p-2 rounded-xl text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 transition duration-150" 
            @click="showDrawer = !showDrawer"
          >
            <!-- Custom info icon -->
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </template>
      </MessagePane>
      <div v-else class="flex-1 flex flex-col items-center justify-center gap-3 bg-[var(--c-bg-panel-soft)] backdrop-blur-sm select-none">
        <div class="relative">
          <div class="w-24 h-24 rounded-[28px] bg-gradient-to-br from-[rgba(0,198,112,0.14)] to-[rgba(0,198,112,0.04)] flex items-center justify-center text-5xl shadow-sm">
            💬
          </div>
          <div class="absolute -right-2 -bottom-1 w-9 h-9 rounded-2xl bg-white shadow-md flex items-center justify-center text-lg rotate-6">
            ✨
          </div>
        </div>
        <p class="font-semibold text-lg text-neutral-600 mt-3">选择一个会话开始沟通</p>
        <p class="text-xs text-neutral-400">左侧选择会话，或到「通讯录」「发现」找到好友与群组</p>
      </div>
    </main>

    <!-- Collapsible Workspace Details Drawer -->
    <transition name="slide-drawer">
      <aside 
        v-if="showDrawer && activeConvId" 
        class="w-[280px] min-w-[280px] xl:w-[300px] xl:min-w-[300px] border-l border-white/20 bg-white/95 backdrop-blur-2xl shadow-2xl h-full min-h-0 overflow-hidden flex flex-col transition-all duration-300 ease-out"
      >
        <!-- Header -->
        <header class="p-6 border-b border-neutral-100 flex items-center justify-between">
          <h3 class="font-bold text-neutral-800 text-lg">会话详情</h3>
          <button type="button" class="text-neutral-400 hover:text-neutral-600" @click="showDrawer = false">✕</button>
        </header>

        <!-- Body -->
        <div class="flex-1 min-h-0 p-6 space-y-6 overflow-y-auto">
          <!-- 1. GROUP CHAT DETAILS -->
          <div v-if="isGroup && activeGroup" class="space-y-6">
            <div class="flex flex-col items-center text-center space-y-3">
              <div class="w-20 h-20 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl font-bold shadow-inner">
                {{ activeGroup.name.substring(0, 1) }}
              </div>
              <div v-if="!isEditingGroupName" class="flex items-center gap-2">
                <h4 class="font-bold text-neutral-800 text-xl">{{ activeGroup.name }}</h4>
                <button v-if="canManageGroup" class="text-neutral-400 hover:text-neutral-600 text-sm" @click="startEditGroupName">✍️</button>
              </div>
              <div v-else class="flex items-center gap-2 w-full">
                <input v-model="groupNameText" type="text" class="px-3 py-1.5 border border-neutral-200 rounded-lg text-sm w-full outline-none focus:border-emerald-500" />
                <button class="bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs" @click="saveGroupName">保存</button>
              </div>
              <p class="text-xs text-neutral-400">UUID: {{ activeGroup.groupUuid.substring(0, 8) }}...</p>
            </div>

            <!-- Group Notice -->
            <div class="bg-neutral-50 rounded-2xl p-4 border border-neutral-100">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold text-neutral-400 uppercase tracking-wider">群公告</span>
                <button v-if="canManageGroup && !isEditingNotice" class="text-xs text-emerald-600 font-semibold" @click="startEditNotice">修改</button>
              </div>
              <div v-if="!isEditingNotice" class="text-neutral-600 text-sm leading-relaxed whitespace-pre-wrap">
                {{ activeGroup.notice || '暂无群公告' }}
              </div>
              <div v-else class="space-y-3">
                <textarea v-model="noticeText" class="w-full text-sm border border-neutral-200 rounded-xl p-3 outline-none focus:border-emerald-500 bg-white" rows="3"></textarea>
                <div class="flex justify-end gap-2">
                  <button class="px-3 py-1.5 bg-neutral-200 text-neutral-600 rounded-lg text-xs font-semibold" @click="isEditingNotice = false">取消</button>
                  <button class="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-semibold" @click="saveNotice">保存</button>
                </div>
              </div>
            </div>

            <!-- Group Join Requests Row -->
            <div 
              v-if="canManageGroup" 
              class="bg-neutral-50 rounded-2xl p-4 border border-neutral-100 flex items-center justify-between cursor-pointer hover:bg-emerald-50/50 hover:border-emerald-200/50 transition duration-200" 
              @click="openJoinRequestsModal"
            >
              <div class="flex items-center gap-2.5">
                <span class="text-sm font-semibold text-neutral-700">加群申请审批</span>
                <span 
                  v-if="activeGroup && (groupStore.pendingRequestsCount[activeGroup.groupUuid] || 0) > 0" 
                  class="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-pulse"
                >
                  {{ groupStore.pendingRequestsCount[activeGroup.groupUuid] }}
                </span>
              </div>
              <span class="text-neutral-400 text-xs">查看 ➔</span>
            </div>

            <!-- Members list grid -->
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-neutral-400 uppercase tracking-wider">群成员 ({{ activeMembers.length }})</span>
              </div>
              
              <div class="grid grid-cols-5 gap-3">
                <!-- Add Icon -->
                <button 
                  v-if="canManageGroup"
                  type="button" 
                  class="flex flex-col items-center justify-center aspect-square rounded-xl border-2 border-dashed border-neutral-200 hover:border-emerald-500 hover:bg-emerald-50 text-neutral-400 hover:text-emerald-600 transition cursor-pointer" 
                  title="邀请新成员"
                  @click="openInviteModal"
                >
                  <span class="text-xl font-bold">+</span>
                </button>
                <!-- Kick Icon -->
                <button 
                  v-if="canManageGroup"
                  type="button" 
                  class="flex flex-col items-center justify-center aspect-square rounded-xl border-2 border-dashed border-neutral-200 hover:border-red-500 hover:bg-red-50 text-neutral-400 hover:text-red-600 transition cursor-pointer" 
                  title="踢出群成员"
                  @click="openKickModal"
                >
                  <span class="text-xl font-bold">-</span>
                </button>

                <!-- Normal Members -->
                <div 
                  v-for="member in activeMembers.slice(0, 13)" 
                  :key="member.userUuid" 
                  class="flex flex-col items-center text-center space-y-1 relative group cursor-pointer hover:scale-105 transition duration-150"
                  :title="member.groupNickname || member.nickname"
                  @click="openMemberDetail(member)"
                >
                  <div class="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center font-bold text-neutral-600 text-sm">
                    {{ (member.groupNickname || member.nickname).substring(0, 1) }}
                  </div>
                  <span class="text-[10px] text-neutral-500 truncate w-full">{{ member.groupNickname || member.nickname }}</span>
                  <span v-if="member.role === 1" class="absolute -top-1 -right-1 bg-blue-500 text-white text-[8px] px-1 rounded-full scale-90">管</span>
                  <span v-if="activeGroup.ownerUuid === member.userUuid" class="absolute -top-1 -right-1 bg-amber-500 text-white text-[8px] px-1 rounded-full scale-90">主</span>
                  <span v-if="member.muteUntil > Date.now()" class="absolute -bottom-1 -right-1 bg-rose-500 text-white text-[8px] p-0.5 rounded-full scale-90 shadow-sm" title="已禁言">🔇</span>
                </div>
              </div>

              <!-- View All Members Button -->
              <button 
                v-if="activeMembers.length > 13" 
                class="w-full text-center py-2 bg-neutral-50 hover:bg-neutral-100 text-emerald-600 font-semibold text-xs rounded-xl border border-neutral-100 transition duration-150 cursor-pointer"
                @click="showAllMembersModal = true"
              >
                查看全部群成员 ({{ activeMembers.length }})
              </button>
            </div>

            <!-- Group Management Settings -->
            <div class="space-y-4 pt-4 border-t border-neutral-100">
              <!-- Mute All Toggle -->
              <div v-if="canManageGroup" class="flex items-center justify-between py-2">
                <span class="text-neutral-700 font-medium text-sm">全员禁言</span>
                <button 
                  type="button" 
                  class="w-11 h-6 rounded-full p-0.5 transition duration-200 outline-none" 
                  :class="activeGroup.muteAll ? 'bg-emerald-500' : 'bg-neutral-200'"
                  @click="toggleMuteAll"
                >
                  <div class="w-5 h-5 bg-white rounded-full shadow-sm transform transition duration-200" :class="{ 'translate-x-5': activeGroup.muteAll }"></div>
                </button>
              </div>

              <!-- General actions -->
              <div class="space-y-2 pt-2">
                <button 
                  v-if="currentUserGroupRole !== 2" 
                  class="w-full py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold rounded-xl text-sm transition"
                  @click="handleLeaveGroup"
                >
                  退出群聊
                </button>
                <button 
                  v-if="currentUserGroupRole === 2" 
                  class="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-xl text-sm transition"
                  @click="handleDismissGroup"
                >
                  解散该群
                </button>
              </div>
            </div>
          </div>

          <!-- 2. P2P FRIEND DETAILS -->
          <div v-else-if="currentFriend" class="space-y-6">
            <div class="flex flex-col items-center text-center space-y-3">
              <div class="w-20 h-20 rounded-2xl bg-neutral-100 text-neutral-600 flex items-center justify-center text-3xl font-bold shadow-inner">
                {{ (currentFriend.payload.nickname as string).substring(0, 1) }}
              </div>
              <h4 class="font-bold text-neutral-800 text-xl">{{ currentFriend.payload.nickname }}</h4>
              <p class="text-xs text-neutral-400">UUID: {{ currentFriend.peerUuid.substring(0, 8) }}...</p>
            </div>

            <!-- Profile Settings -->
            <div class="space-y-4">
              <!-- Remark -->
              <div class="space-y-1.5">
                <label class="text-xs font-bold text-neutral-400 uppercase tracking-wider">好友备注</label>
                <div class="flex gap-2">
                  <input v-model="friendRemark" type="text" class="flex-1 text-sm border border-neutral-200 rounded-xl px-3 py-2 outline-none focus:border-emerald-500 bg-neutral-50/50" />
                  <button class="bg-emerald-500 text-white px-3.5 rounded-xl text-xs font-bold" @click="saveFriendRemark">保存</button>
                </div>
              </div>

              <!-- Tag -->
              <div class="space-y-1.5">
                <label class="text-xs font-bold text-neutral-400 uppercase tracking-wider">标签分组</label>
                <div class="flex gap-2">
                  <input v-model="friendTag" type="text" class="flex-1 text-sm border border-neutral-200 rounded-xl px-3 py-2 outline-none focus:border-emerald-500 bg-neutral-50/50" />
                  <button class="bg-emerald-500 text-white px-3.5 rounded-xl text-xs font-bold" @click="saveFriendTag">保存</button>
                </div>
              </div>
            </div>

            <!-- Block & Delete actions -->
            <div class="pt-6 border-t border-neutral-100 space-y-3">
              <button 
                class="w-full py-2.5 border font-semibold rounded-xl text-sm transition"
                :class="isBlacklisted ? 'bg-amber-500/10 border-amber-200 text-amber-600 hover:bg-amber-50' : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:bg-neutral-100'"
                @click="toggleBlacklist"
              >
                {{ isBlacklisted ? '移出黑名单' : '加入黑名单' }}
              </button>
              <button 
                class="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-xl text-sm transition"
                @click="handleDeleteFriend"
              >
                删除好友
              </button>
            </div>
          </div>
        </div>
      </aside>
    </transition>

    <!-- Invite Friends Modal -->
    <div v-if="showInviteModal" class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-3xl w-[360px] max-h-[480px] flex flex-col shadow-2xl overflow-hidden animate-slideUp">
        <header class="p-5 border-b border-neutral-100 flex items-center justify-between">
          <h4 class="font-bold text-neutral-800 text-lg">邀请好友加入群聊</h4>
          <button class="text-neutral-400 hover:text-neutral-600" @click="showInviteModal = false">✕</button>
        </header>
        <div class="flex-1 p-5 overflow-y-auto space-y-3">
          <p v-if="inviteableFriends.length === 0" class="text-center text-neutral-400 text-sm py-8">无可以邀请的好友</p>
          <label 
            v-for="friend in inviteableFriends" 
            :key="friend.peerUuid" 
            class="flex items-center gap-3 p-3 rounded-2xl hover:bg-neutral-50 border border-neutral-50 cursor-pointer"
          >
            <input type="checkbox" v-model="inviteList" :value="friend.peerUuid" class="w-4 h-4 text-emerald-500 accent-emerald-500 border-neutral-300 rounded focus:ring-emerald-500" />
            <div class="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-600 font-bold">
              {{ (friend.payload.nickname as string).substring(0,1) }}
            </div>
            <span class="text-neutral-700 font-semibold text-sm">{{ friend.payload.remark || friend.payload.nickname }}</span>
          </label>
        </div>
        <footer class="p-5 border-t border-neutral-100 flex justify-end gap-3 bg-neutral-50/50">
          <button class="px-4 py-2 bg-neutral-200 text-neutral-600 rounded-xl text-xs font-bold" @click="showInviteModal = false">取消</button>
          <button class="px-5 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md hover:bg-emerald-600 transition" @click="submitInvite">确认邀请</button>
        </footer>
      </div>
    </div>

    <!-- Kick Members Modal -->
    <div v-if="showKickModal" class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-3xl w-[360px] max-h-[480px] flex flex-col shadow-2xl overflow-hidden animate-slideUp">
        <header class="p-5 border-b border-neutral-100 flex items-center justify-between">
          <h4 class="font-bold text-neutral-800 text-lg">移除群成员</h4>
          <button class="text-neutral-400 hover:text-neutral-600" @click="showKickModal = false">✕</button>
        </header>
        <div class="flex-1 p-5 overflow-y-auto space-y-3">
          <p v-if="kickableMembers.length === 0" class="text-center text-neutral-400 text-sm py-8">无可以移除的成员</p>
          <label 
            v-for="member in kickableMembers" 
            :key="member.userUuid" 
            class="flex items-center gap-3 p-3 rounded-2xl hover:bg-red-50/50 border border-neutral-50 cursor-pointer"
          >
            <input type="checkbox" v-model="kickList" :value="member.userUuid" class="w-4 h-4 text-red-500 accent-red-500 border-neutral-300 rounded focus:ring-red-500" />
            <div class="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-600 font-bold">
              {{ (member.groupNickname || member.nickname).substring(0,1) }}
            </div>
            <span class="text-neutral-700 font-semibold text-sm">{{ member.groupNickname || member.nickname }}</span>
          </label>
        </div>
        <footer class="p-5 border-t border-neutral-100 flex justify-end gap-3 bg-neutral-50/50">
          <button class="px-4 py-2 bg-neutral-200 text-neutral-600 rounded-xl text-xs font-bold" @click="showKickModal = false">取消</button>
          <button class="px-5 py-2 bg-red-500 text-white rounded-xl text-xs font-bold shadow-md hover:bg-red-600 transition" @click="submitKick">确认移除</button>
        </footer>
      </div>
    </div>

    <!-- Join Requests Modal -->
    <div v-if="showJoinRequestsModal && activeGroup" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white/90 backdrop-blur-md rounded-3xl w-[500px] max-h-[600px] flex flex-col shadow-2xl overflow-hidden border border-white/20 animate-slideUp">
        <header class="p-5 border-b border-neutral-100 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <h4 class="font-bold text-neutral-800 text-lg">加群申请审批</h4>
            <span class="text-xs text-neutral-500 font-medium">({{ activeGroup.name }})</span>
          </div>
          <button class="text-neutral-400 hover:text-neutral-600 cursor-pointer" @click="showJoinRequestsModal = false">✕</button>
        </header>
        
        <div class="flex-1 p-5 overflow-y-auto space-y-4">
          <p v-if="!groupStore.joinRequests[activeGroup?.groupUuid || ''] || (groupStore.joinRequests[activeGroup?.groupUuid || '']?.length ?? 0) === 0" class="text-center text-neutral-400 text-sm py-12">
            暂无待处理的加群申请
          </p>
          
          <div 
            v-for="req in groupStore.joinRequests[activeGroup?.groupUuid || ''] || []" 
            :key="req.applyId" 
            class="p-4 rounded-2xl bg-neutral-50/80 border border-neutral-100/50 space-y-3 animate-fadeIn"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-neutral-200 text-neutral-700 flex items-center justify-center font-bold text-sm">
                  {{ req.nickname.substring(0, 1) }}
                </div>
                <div class="text-left">
                  <h5 class="text-neutral-800 font-bold text-sm">{{ req.nickname }}</h5>
                  <p class="text-[10px] text-neutral-400">UUID: {{ req.applicantUuid }}</p>
                </div>
              </div>
              <span class="text-[10px] text-neutral-400 font-medium">
                {{ new Date(req.createdAt).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', month: '2-digit', day: '2-digit' }) }}
              </span>
            </div>
            
            <div class="bg-white/80 p-3 rounded-xl border border-neutral-100 text-xs text-neutral-600 text-left">
              <span class="font-bold text-neutral-400 block mb-1">申请理由：</span>
              {{ req.reason || '未填写申请理由' }}
            </div>

            <!-- Review remark and action buttons -->
            <div class="flex items-center gap-3 pt-1">
              <input 
                v-model="reviewRemark" 
                type="text" 
                placeholder="填写审批备注 (可选)..." 
                class="flex-1 text-xs px-3 py-2 border border-neutral-200 rounded-xl outline-none focus:border-emerald-500 bg-white/50"
              />
              <div class="flex gap-2">
                <button 
                  class="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition cursor-pointer"
                  @click="handleReviewRequest(req.applyId, 2)"
                >
                  拒绝
                </button>
                <button 
                  class="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
                  @click="handleReviewRequest(req.applyId, 1)"
                >
                  同意
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <footer class="p-5 border-t border-neutral-100 flex justify-end bg-neutral-50/50">
          <button class="px-5 py-2 bg-neutral-200 text-neutral-600 rounded-xl text-xs font-bold cursor-pointer" @click="showJoinRequestsModal = false">关闭</button>
        </footer>
      </div>
    </div>

    <!-- All Members Modal -->
    <div v-if="showAllMembersModal && activeGroup" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white/90 backdrop-blur-md rounded-3xl w-[400px] max-h-[550px] flex flex-col shadow-2xl overflow-hidden border border-white/20 animate-slideUp">
        <header class="p-5 border-b border-neutral-100 flex items-center justify-between">
          <h4 class="font-bold text-neutral-800 text-lg">全部群成员 ({{ activeMembers.length }})</h4>
          <button class="text-neutral-400 hover:text-neutral-600 cursor-pointer" @click="showAllMembersModal = false">✕</button>
        </header>
        
        <!-- Search Input -->
        <div class="p-4 border-b border-neutral-100 bg-neutral-50/30">
          <input 
            v-model="memberSearchKeyword" 
            type="text" 
            placeholder="搜索昵称或 UUID..." 
            class="w-full text-xs px-3 py-2.5 border border-neutral-200 rounded-xl outline-none focus:border-emerald-500 bg-white/70 shadow-sm"
          />
        </div>

        <!-- Members List -->
        <div class="flex-1 p-4 overflow-y-auto space-y-2.5">
          <p v-if="filteredAllMembers.length === 0" class="text-center text-neutral-400 text-sm py-8">
            未匹配到任何成员
          </p>
          
          <div 
            v-for="member in filteredAllMembers" 
            :key="member.userUuid" 
            class="flex items-center justify-between p-2.5 rounded-xl hover:bg-neutral-50/80 cursor-pointer transition duration-150"
            @click="openMemberDetail(member)"
          >
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-lg bg-neutral-100 text-neutral-600 flex items-center justify-center font-bold text-sm">
                {{ (member.groupNickname || member.nickname).substring(0, 1) }}
              </div>
              <div class="text-left">
                <h5 class="text-neutral-800 font-bold text-sm">{{ member.groupNickname || member.nickname }}</h5>
                <p class="text-[10px] text-neutral-400">UUID: {{ member.userUuid.substring(0, 8) }}...</p>
              </div>
            </div>
            
            <div class="flex items-center gap-1.5">
              <span v-if="member.muteUntil > Date.now()" class="bg-rose-100 text-rose-600 text-[8px] font-bold px-1.5 py-0.5 rounded">已禁言</span>
              <span v-if="member.role === 1" class="bg-blue-100 text-blue-600 text-[8px] font-bold px-1.5 py-0.5 rounded">管理员</span>
              <span v-if="activeGroup.ownerUuid === member.userUuid" class="bg-amber-100 text-amber-600 text-[8px] font-bold px-1.5 py-0.5 rounded">群主</span>
            </div>
          </div>
        </div>
        
        <footer class="p-4 border-t border-neutral-100 flex justify-end bg-neutral-50/50">
          <button class="px-5 py-2 bg-neutral-200 text-neutral-600 rounded-xl text-xs font-bold cursor-pointer" @click="showAllMembersModal = false">关闭</button>
        </footer>
      </div>
    </div>

    <!-- Member Detail & Management Modal -->
    <div v-if="showMemberDetailModal && selectedMember && activeGroup" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white/95 backdrop-blur-xl rounded-3xl w-[360px] flex flex-col shadow-2xl overflow-hidden border border-white/20 animate-slideUp">
        <header class="p-5 border-b border-neutral-100 flex items-center justify-between">
          <h4 class="font-bold text-neutral-800 text-base">成员资料与管理</h4>
          <button class="text-neutral-400 hover:text-neutral-600 cursor-pointer" @click="showMemberDetailModal = false">✕</button>
        </header>
        
        <div class="p-6 space-y-6">
          <!-- Profile Card Header -->
          <div class="flex flex-col items-center text-center space-y-2">
            <div class="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center font-bold text-neutral-600 text-2xl shadow-inner">
              {{ (selectedMember.groupNickname || selectedMember.nickname).substring(0, 1) }}
            </div>
            <div>
              <h4 class="font-bold text-neutral-800 text-lg">{{ selectedMember.groupNickname || selectedMember.nickname }}</h4>
              <p v-if="selectedMember.groupNickname" class="text-xs text-neutral-400 mt-0.5">昵称: {{ selectedMember.nickname }}</p>
              <p class="text-[10px] text-neutral-400 font-mono mt-1 select-all" title="双击复制 UUID">UUID: {{ selectedMember.userUuid }}</p>
            </div>
            <div class="flex items-center gap-2 pt-1 justify-center">
              <span 
                class="text-[10px] font-bold px-2 py-0.5 rounded-full"
                :class="activeGroup.ownerUuid === selectedMember.userUuid ? 'bg-amber-100 text-amber-700' : selectedMember.role === 1 ? 'bg-blue-100 text-blue-700' : 'bg-neutral-100 text-neutral-700'"
              >
                {{ activeGroup.ownerUuid === selectedMember.userUuid ? '群主' : selectedMember.role === 1 ? '管理员' : '群成员' }}
              </span>
              <span v-if="isMemberMuted" class="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                已禁言 (剩 {{ memberMuteRemainingText }})
              </span>
            </div>
          </div>

          <!-- Interactive Management Actions -->
          <div v-if="canManageSelectedMember" class="space-y-4 pt-4 border-t border-neutral-100 text-left">
            <!-- Mute Controls -->
            <div class="space-y-2">
              <label class="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">禁言管理</label>
              <div class="grid grid-cols-4 gap-2">
                <button 
                  v-if="isMemberMuted"
                  class="col-span-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 text-xs font-bold rounded-xl transition cursor-pointer"
                  @click="handleMuteMember(0)"
                >
                  解除禁言
                </button>
                <template v-else>
                  <button class="py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold rounded-xl transition cursor-pointer" @click="handleMuteMember(10 * 60000)">10分钟</button>
                  <button class="py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold rounded-xl transition cursor-pointer" @click="handleMuteMember(60 * 60000)">1小时</button>
                  <button class="py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold rounded-xl transition cursor-pointer" @click="handleMuteMember(24 * 60 * 60000)">1天</button>
                  <button class="py-2 bg-rose-50/50 hover:bg-rose-100/50 text-rose-500 text-xs font-semibold rounded-xl transition cursor-pointer" @click="handleMuteMember(30 * 24 * 60 * 60000)">30天</button>
                </template>
              </div>
            </div>

            <!-- Role Promotion -->
            <div v-if="currentUserGroupRole === 2" class="space-y-2 pt-2">
              <label class="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">角色管理</label>
              <button 
                class="w-full py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold rounded-xl transition cursor-pointer text-center"
                @click="handleToggleAdminRole"
              >
                {{ selectedMember.role === 1 ? '取消管理员身份' : '设为管理员' }}
              </button>
            </div>

            <!-- Owner Transfer & Kick Actions -->
            <div class="pt-4 border-t border-neutral-100 space-y-2">
              <button 
                v-if="currentUserGroupRole === 2"
                class="w-full py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold rounded-xl transition cursor-pointer text-center"
                @click="handleTransferOwnerSelectedMember"
              >
                转让群主职务
              </button>
              <button 
                class="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl transition cursor-pointer text-center"
                @click="handleKickSelectedMember"
              >
                从群组中踢出
              </button>
            </div>
          </div>
          <p v-else class="text-center text-xs text-neutral-400 py-2 border-t border-neutral-100">
            没有对此成员的管理权限
          </p>
        </div>
        
        <footer class="p-4 border-t border-neutral-100 flex justify-end bg-neutral-50/50">
          <button class="px-5 py-2 bg-neutral-200 text-neutral-600 rounded-xl text-xs font-bold cursor-pointer" @click="showMemberDetailModal = false">关闭</button>
        </footer>
      </div>
    </div>

  </div>
</template>

<style scoped>
.slide-drawer-enter-active,
.slide-drawer-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-drawer-enter-from,
.slide-drawer-leave-to {
  width: 0px;
  min-width: 0px;
  opacity: 0;
  transform: translateX(30px);
}
</style>
