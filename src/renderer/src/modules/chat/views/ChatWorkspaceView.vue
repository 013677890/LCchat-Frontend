<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import ConversationPane from '../components/ConversationPane.vue'
import MessagePane from '../components/MessagePane.vue'
import SidebarNav from '../components/SidebarNav.vue'
import DetailPane from '../../contact/components/DetailPane.vue'
import ListPane from '../../contact/components/ListPane.vue'
import ScannedUserProfileCard from '../../discover/components/ScannedUserProfileCard.vue'
import UserSearchCard from '../../discover/components/UserSearchCard.vue'
import SentApplyListCard from '../../discover/components/SentApplyListCard.vue'
import SettingsActionsPanel from '../../settings/components/SettingsActionsPanel.vue'
import {
  fetchOtherProfile,
  fetchRelationStatus,
  searchUsers,
  sendFriendApply,
  type SearchUserItemDTO
} from '../../contact/api'
import {
  buildFriendGroups,
  type FriendGroup,
  type FriendGroupItem
} from '../../contact/utils/friend-grouping'
import { resolveRelationErrorMessage } from '../../contact/error-message'
import { useSettingsActions } from '../composables/useSettingsActions'
import { useAppStore, type MainNavKey } from '../../../stores/app.store'
import { useApplyStore } from '../../../stores/apply.store'
import { useAuthStore } from '../../../stores/auth.store'
import { useBlacklistStore } from '../../../stores/blacklist.store'
import { useDeviceStore } from '../../../stores/device.store'
import { useFriendStore } from '../../../stores/friend.store'
import { usePresenceStore } from '../../../stores/presence.store'
import { useSessionStore } from '../../../stores/session.store'
import { useUserStore } from '../../../stores/user.store'
import { normalizeErrorMessage } from '../../../shared/utils/error'
import { formatPresenceStatusText } from '../../../shared/utils/presence'
import { formatConversationTime } from '../../../shared/utils/time'

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
  online?: boolean
  groupTag?: string
}

interface SearchResultItem {
  uuid: string
  nickname: string
  avatar: string
  signature: string
  isFriend: boolean
  isOnline: boolean | null
  lastSeenAt: string
  presenceText: string
}

interface SentApplyListItem {
  applyId: number
  targetUuid: string
  targetNickname: string
  reason: string
  status: number
  createdAt: number
}

interface ProfileEditorData {
  uuid: string
  email: string
  telephone: string
  avatar: string
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
const presenceStore = usePresenceStore()
const sessionStore = useSessionStore()
const userStore = useUserStore()

const selectedFriendId = ref('')
const selectedApplyId = ref('')
const selectedBlacklistId = ref('')
const applyActionPending = ref(false)
const applyActionError = ref('')
const contactActionPending = ref(false)
const contactActionError = ref('')
const contactRemarkDraft = ref('')
const contactTagDraft = ref('')
const searchKeyword = ref('')
const searchReasonDraft = ref('我是 LCchat 用户')
const searchResults = ref<SearchResultItem[]>([])
const searchingUsers = ref(false)
const sendingApplyTarget = ref('')
const searchError = ref('')
const searchMessage = ref('')
const scannedProfile = ref<SearchResultItem | null>(null)
const scannedProfileLoading = ref(false)
const scannedProfileBlocked = ref(false)
const scannedProfileError = ref('')
const scannedProfileMessage = ref('')
const retryingSentApplyId = ref(0)
const sentApplyError = ref('')
const sentApplyMessage = ref('')

const { activeNav } = storeToRefs(appStore)
const { userUuid, session } = storeToRefs(authStore)
const { profile, qrCode } = storeToRefs(userStore)
const { friends, tagSuggestions } = storeToRefs(friendStore)
const { statusByUserUuid: presenceByUserUuid } = storeToRefs(presenceStore)
const { items: blacklistItems } = storeToRefs(blacklistStore)
const { loading: deviceLoading } = storeToRefs(deviceStore)
const {
  inbox: applyInbox,
  sent: sentApplies,
  unreadCount: applyUnreadCount,
  unreadCountSynced
} = storeToRefs(applyStore)
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

function getPresenceState(userUuid: string): { isOnline: boolean | null; lastSeenAt: string } {
  const normalizedUuid = userUuid.trim()
  if (!normalizedUuid) {
    return {
      isOnline: null,
      lastSeenAt: ''
    }
  }

  const status = presenceByUserUuid.value[normalizedUuid]
  if (!status) {
    return {
      isOnline: null,
      lastSeenAt: ''
    }
  }

  return {
    isOnline: status.isOnline,
    lastSeenAt: status.lastSeenAt
  }
}

function mapSearchResult(item: SearchUserItemDTO): SearchResultItem {
  return {
    uuid: item.uuid,
    nickname: item.nickname || item.uuid,
    avatar: item.avatar || '',
    signature: item.signature || '',
    isFriend: Boolean(item.isFriend),
    isOnline: null,
    lastSeenAt: '',
    presenceText: '状态未知'
  }
}

function isExistingFriend(peerUuid: string): boolean {
  return friends.value.some((item) => item.peerUuid === peerUuid)
}

function isPeerInBlacklist(peerUuid: string): boolean {
  return blacklistItems.value.some((item) => item.peerUuid === peerUuid)
}

function formatDateTime(timestamp: number): string {
  if (!timestamp) {
    return '-'
  }
  return new Date(timestamp).toLocaleString('zh-CN')
}

function formatPresenceText(userUuid: string): string {
  return formatPresenceStatusText(getPresenceState(userUuid))
}

const userLabel = computed(() => {
  const nickname = profile.value ? getString(profile.value.payload, 'nickname') : ''
  return nickname || userUuid.value || '匿名用户'
})

const localUnreadApplyCount = computed(() =>
  applyInbox.value.reduce((count, row) => count + (getBoolean(row.payload, 'isRead') ? 0 : 1), 0)
)
const unreadApplyCount = computed(() =>
  unreadCountSynced.value ? applyUnreadCount.value : localUnreadApplyCount.value
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
  friends.value.map((row) => {
    const presenceState = getPresenceState(row.peerUuid)
    const signature = getString(row.payload, 'signature') || ''
    const presenceText = formatPresenceStatusText(presenceState)
    const groupTag = getString(row.payload, 'groupTag') || '未分组'
    return {
      id: row.peerUuid,
      title: getString(row.payload, 'remark') || getString(row.payload, 'nickname') || row.peerUuid,
      subtitle: signature ? `${presenceText} · ${signature}` : presenceText,
      online: presenceState.isOnline === true,
      groupTag
    }
  })
)
const friendPaneGroups = computed<FriendGroup<PaneItem & FriendGroupItem>[]>(() =>
  buildFriendGroups(
    friendPaneItems.value as Array<PaneItem & FriendGroupItem>,
    tagSuggestionNames.value
  )
)
const friendListHint = computed(
  () => `${friendPaneItems.value.length} 位好友 · ${friendPaneGroups.value.length} 组`
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

const existingFriendIds = computed(() => friends.value.map((item) => item.peerUuid))
const blacklistPeerIds = computed(() => blacklistItems.value.map((item) => item.peerUuid))
const searchResultItems = computed<SearchResultItem[]>(() =>
  searchResults.value.map((item) => {
    const presence = getPresenceState(item.uuid)
    return {
      ...item,
      isOnline: presence.isOnline,
      lastSeenAt: presence.lastSeenAt,
      presenceText: formatPresenceStatusText(presence)
    }
  })
)
const sentApplyItems = computed<SentApplyListItem[]>(() =>
  sentApplies.value.map((row) => ({
    applyId: row.applyId,
    targetUuid: getString(row.payload, 'targetUuid'),
    targetNickname:
      getString(row.payload, 'targetNickname') || getString(row.payload, 'targetUuid'),
    reason: getString(row.payload, 'reason'),
    status: row.status,
    createdAt: getNumber(row.payload, 'createdAt')
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

watch(
  () => friends.value.map((item) => item.peerUuid).join(','),
  (joinedIds) => {
    if (!joinedIds) {
      return
    }
    void presenceStore.syncBatch(joinedIds.split(','))
  },
  { immediate: true }
)

watch(
  () => searchResults.value.map((item) => item.uuid).join(','),
  (joinedIds) => {
    if (!joinedIds) {
      return
    }
    void presenceStore.syncBatch(joinedIds.split(','))
  }
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
const settingsActions = useSettingsActions({
  userUuid,
  session,
  selectedBlacklistRow,
  authStore,
  userStore,
  friendStore,
  blacklistStore,
  deviceStore,
  onQRCodeResolved: handleQRCodeResolved,
  onSignedOut: resetAndNavigateLogin
})
const {
  blacklistActionPending,
  blacklistActionError,
  deviceActionPendingId,
  deviceActionError,
  profileSavePending,
  profileSaveError,
  avatarUploadPending,
  qrcodeLoading,
  qrcodeParsing,
  qrcodeMessage,
  qrcodeError,
  securityMessage,
  securityError,
  sendingVerifyCode,
  codeCooldownSeconds,
  changingEmail,
  changingPassword,
  deletingAccount,
  settingDeviceItems,
  clearProfileError,
  clearQRCodeFeedback,
  clearSecurityFeedback,
  handleRemoveBlacklist,
  handleReloadDevices,
  handleProfileSave,
  handleProfileAvatarUpload,
  handleLoadQRCode,
  handleParseQRCode,
  handleRequestEmailCode,
  handleSubmitEmail,
  handleSubmitPassword,
  handleSubmitDelete,
  handleKickDevice,
  handleLogout,
  resetState: resetSettingsState,
  dispose: disposeSettingsActions
} = settingsActions
const selectedBlacklistLabel = computed(() =>
  selectedBlacklistRow.value
    ? getString(selectedBlacklistRow.value.payload, 'nickname') ||
      selectedBlacklistRow.value.peerUuid
    : ''
)
const tagSuggestionNames = computed(() => tagSuggestions.value.map((item) => item.tagName))

watch(
  () => activeNav.value,
  (nextNav) => {
    if (nextNav !== 'settings' || qrcodeLoading.value || qrCode.value) {
      return
    }

    void handleLoadQRCode()
  },
  { immediate: true }
)

const contactRemarkChanged = computed(() => {
  if (!selectedFriendRow.value) {
    return false
  }
  return contactRemarkDraft.value.trim() !== getString(selectedFriendRow.value.payload, 'remark')
})
const contactTagChanged = computed(() => {
  if (!selectedFriendRow.value) {
    return false
  }
  return contactTagDraft.value.trim() !== getString(selectedFriendRow.value.payload, 'groupTag')
})
const selectedApplyIsPending = computed(() => selectedApplyRow.value?.status === 0)
const selectedApplyIsRead = computed(() =>
  selectedApplyRow.value ? getBoolean(selectedApplyRow.value.payload, 'isRead') : true
)

watch(
  selectedFriendRow,
  (row) => {
    if (!row) {
      contactRemarkDraft.value = ''
      contactTagDraft.value = ''
      return
    }

    contactRemarkDraft.value = getString(row.payload, 'remark')
    contactTagDraft.value = getString(row.payload, 'groupTag')
    contactActionError.value = ''
  },
  { immediate: true }
)

const contactDetailLines = computed(() => {
  if (!selectedFriendRow.value) {
    return []
  }

  const payload = selectedFriendRow.value.payload
  return [
    { label: '好友 UUID', value: selectedFriendRow.value.peerUuid },
    { label: '昵称', value: getString(payload, 'nickname') || '-' },
    { label: '在线状态', value: formatPresenceText(selectedFriendRow.value.peerUuid) },
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
    avatar: getString(payload, 'avatar'),
    nickname: getString(payload, 'nickname'),
    gender: gender === 1 || gender === 2 || gender === 3 ? gender : 3,
    birthday: getString(payload, 'birthday'),
    signature: getString(payload, 'signature')
  }
})

const currentEmail = computed(() => {
  if (!profile.value) {
    return ''
  }
  return getString(profile.value.payload, 'email')
})

async function handleNavChange(nextNav: MainNavKey): Promise<void> {
  appStore.setActiveNav(nextNav)
}

async function handleConversationSelect(convId: string): Promise<void> {
  await sessionStore.openConversation(convId)
}

function handleFriendSelect(id: string): void {
  contactActionError.value = ''
  selectedFriendId.value = id
}

function handleApplySelect(id: string): void {
  applyActionError.value = ''
  selectedApplyId.value = id
}

function handleBlacklistSelect(id: string): void {
  blacklistActionError.value = ''
  selectedBlacklistId.value = id
}

function handleProfileInput(): void {
  clearProfileError()
}

function handleContactInput(): void {
  contactActionError.value = ''
}

function clearSearchFeedback(): void {
  searchError.value = ''
  searchMessage.value = ''
}

function clearScannedProfileFeedback(): void {
  scannedProfileError.value = ''
  scannedProfileMessage.value = ''
}

function clearScannedProfile(): void {
  scannedProfile.value = null
  scannedProfileBlocked.value = false
  scannedProfileLoading.value = false
  clearScannedProfileFeedback()
}

function setDiscoverError(source: 'desktop_search' | 'desktop_qrcode', message: string): void {
  if (source === 'desktop_qrcode') {
    scannedProfileError.value = message
    return
  }
  searchError.value = message
}

function setDiscoverMessage(source: 'desktop_search' | 'desktop_qrcode', message: string): void {
  if (source === 'desktop_qrcode') {
    scannedProfileMessage.value = message
    return
  }
  searchMessage.value = message
}

function clearSentApplyFeedback(): void {
  sentApplyError.value = ''
  sentApplyMessage.value = ''
}

function handleSearchInput(): void {
  clearSearchFeedback()
}

function handleScannedProfileInput(): void {
  clearScannedProfileFeedback()
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

async function handleDeleteFriend(): Promise<void> {
  if (!userUuid.value || !selectedFriendRow.value || contactActionPending.value) {
    return
  }

  const nickname =
    getString(selectedFriendRow.value.payload, 'nickname') || selectedFriendRow.value.peerUuid
  const confirmed = window.confirm(`确认删除好友「${nickname}」吗？`)
  if (!confirmed) {
    return
  }

  contactActionPending.value = true
  contactActionError.value = ''
  try {
    await friendStore.removeFriend(userUuid.value, selectedFriendRow.value.peerUuid)
  } catch (error) {
    contactActionError.value = resolveRelationErrorMessage('delete_friend', error)
  } finally {
    contactActionPending.value = false
  }
}

async function handleAddBlacklist(): Promise<void> {
  if (!userUuid.value || !selectedFriendRow.value || contactActionPending.value) {
    return
  }

  const payload = selectedFriendRow.value.payload
  const nickname = getString(payload, 'nickname') || selectedFriendRow.value.peerUuid
  const confirmed = window.confirm(`确认将「${nickname}」加入黑名单吗？`)
  if (!confirmed) {
    return
  }

  contactActionPending.value = true
  contactActionError.value = ''
  try {
    await blacklistStore.addToBlacklist(userUuid.value, selectedFriendRow.value.peerUuid, {
      nickname: getString(payload, 'nickname'),
      avatar: getString(payload, 'avatar')
    })
    await friendStore.syncFromServer(userUuid.value)
  } catch (error) {
    contactActionError.value = resolveRelationErrorMessage('add_blacklist', error)
  } finally {
    contactActionPending.value = false
  }
}

async function handleSearchUsers(): Promise<void> {
  const keyword = searchKeyword.value.trim()
  if (!keyword || searchingUsers.value) {
    return
  }

  clearSearchFeedback()
  searchingUsers.value = true
  try {
    const response = await searchUsers({
      keyword,
      page: 1,
      pageSize: 30
    })

    const allItems = (response.data.items ?? []).map(mapSearchResult)
    searchResults.value = allItems.filter((item) => item.uuid && item.uuid !== userUuid.value)
    if (searchResults.value.length === 0) {
      searchMessage.value = '没有找到匹配用户。'
    }
  } catch (error) {
    searchError.value = normalizeErrorMessage(error)
  } finally {
    searchingUsers.value = false
  }
}

async function handleLoadScannedProfile(targetUuid: string): Promise<void> {
  const normalizedTarget = targetUuid.trim()
  if (!normalizedTarget || scannedProfileLoading.value) {
    return
  }

  scannedProfile.value = null
  scannedProfileLoading.value = true
  scannedProfileBlocked.value = false
  clearScannedProfileFeedback()

  try {
    const profileResponse = await fetchOtherProfile(normalizedTarget)
    const userInfo = profileResponse.data.userInfo
    if (!userInfo?.uuid) {
      throw new Error('未找到该用户')
    }

    let isFriend = Boolean(profileResponse.data.isFriend)
    if (userUuid.value) {
      try {
        const relationResponse = await fetchRelationStatus({
          userUuid: userUuid.value,
          peerUuid: userInfo.uuid
        })
        const relation = relationResponse.data.relation
        isFriend = isFriend || relationResponse.data.isFriend || relation === 'friend'
        scannedProfileBlocked.value =
          Boolean(relationResponse.data.isBlacklist) || relation === 'blacklist'
      } catch (error) {
        console.warn('fetch relation status for scanned profile failed', error)
      }
    }

    await presenceStore.syncSingle(userInfo.uuid)
    const presenceState = getPresenceState(userInfo.uuid)
    scannedProfile.value = {
      uuid: userInfo.uuid,
      nickname: userInfo.nickname || userInfo.uuid,
      avatar: userInfo.avatar || '',
      signature: userInfo.signature || '',
      isFriend,
      isOnline: presenceState.isOnline,
      lastSeenAt: presenceState.lastSeenAt,
      presenceText: formatPresenceStatusText(presenceState)
    }
  } catch (error) {
    scannedProfile.value = null
    scannedProfileBlocked.value = false
    scannedProfileError.value = normalizeErrorMessage(error)
  } finally {
    scannedProfileLoading.value = false
  }
}

async function handleQRCodeResolved(targetUuid: string): Promise<void> {
  const normalizedTarget = targetUuid.trim()
  if (!normalizedTarget) {
    return
  }

  appStore.setActiveNav('discover')
  searchKeyword.value = normalizedTarget
  await handleLoadScannedProfile(normalizedTarget)
}

async function ensureRemoteRelationAllowed(
  targetUuid: string,
  source: 'desktop_search' | 'desktop_qrcode'
): Promise<boolean> {
  if (!userUuid.value) {
    return false
  }

  try {
    const response = await fetchRelationStatus({
      userUuid: userUuid.value,
      peerUuid: targetUuid
    })

    const relation = response.data.relation
    if (response.data.isFriend || relation === 'friend') {
      setDiscoverError(source, '对方已经是你的好友。')
      return false
    }
    if (response.data.isBlacklist || relation === 'blacklist') {
      setDiscoverError(source, '你已将对方拉黑，请先移出黑名单后再申请。')
      return false
    }
  } catch (error) {
    console.warn('check relation status before send apply failed, fallback to direct send', error)
  }

  return true
}

async function handleSendFriendApply(
  targetUuid: string,
  source: 'desktop_search' | 'desktop_qrcode' = 'desktop_search'
): Promise<void> {
  if (!targetUuid || sendingApplyTarget.value) {
    return
  }
  if (!userUuid.value) {
    setDiscoverError(source, '登录状态无效，请重新登录。')
    return
  }
  if (targetUuid === userUuid.value) {
    setDiscoverError(source, '不能添加自己为好友。')
    return
  }
  if (isExistingFriend(targetUuid)) {
    setDiscoverError(source, '对方已经是你的好友。')
    return
  }
  if (
    isPeerInBlacklist(targetUuid) ||
    (source === 'desktop_qrcode' && scannedProfileBlocked.value)
  ) {
    setDiscoverError(source, '对方在黑名单中，请先移出后再申请。')
    return
  }

  if (source === 'desktop_qrcode') {
    clearScannedProfileFeedback()
  } else {
    clearSearchFeedback()
  }
  const relationAllowed = await ensureRemoteRelationAllowed(targetUuid, source)
  if (!relationAllowed) {
    return
  }

  sendingApplyTarget.value = targetUuid
  try {
    await sendFriendApply({
      targetUuid,
      reason: searchReasonDraft.value.trim() || undefined,
      source
    })
    const target =
      searchResultItems.value.find((item) => item.uuid === targetUuid)?.nickname || targetUuid
    setDiscoverMessage(source, `好友申请已发送给 ${target}。`)
    if (source === 'desktop_qrcode' && scannedProfile.value?.uuid === targetUuid) {
      scannedProfile.value = {
        ...scannedProfile.value,
        isFriend: true
      }
    }
    await applyStore.syncSentFromServer(userUuid.value)
  } catch (error) {
    setDiscoverError(source, resolveRelationErrorMessage('send_friend_apply', error))
  } finally {
    sendingApplyTarget.value = ''
  }
}

async function handleRetrySentApply(applyId: number): Promise<void> {
  if (!userUuid.value || !applyId || retryingSentApplyId.value) {
    return
  }

  clearSentApplyFeedback()
  retryingSentApplyId.value = applyId
  try {
    const target =
      sentApplyItems.value.find((item) => item.applyId === applyId)?.targetNickname || '目标用户'
    await applyStore.retrySentApply(userUuid.value, applyId)
    sentApplyMessage.value = `已重新发送申请给 ${target}。`
    await applyStore.syncSentFromServer(userUuid.value)
  } catch (error) {
    sentApplyError.value = resolveRelationErrorMessage('send_friend_apply', error)
  } finally {
    retryingSentApplyId.value = 0
  }
}

async function handleSaveFriendRemark(): Promise<void> {
  if (!userUuid.value || !selectedFriendRow.value || contactActionPending.value) {
    return
  }

  const remark = contactRemarkDraft.value.trim()
  if (!contactRemarkChanged.value) {
    return
  }

  contactActionPending.value = true
  contactActionError.value = ''
  try {
    await friendStore.updateFriendRemark(userUuid.value, selectedFriendRow.value.peerUuid, remark)
  } catch (error) {
    contactActionError.value = resolveRelationErrorMessage('set_friend_remark', error)
  } finally {
    contactActionPending.value = false
  }
}

async function handleSaveFriendTag(): Promise<void> {
  if (!userUuid.value || !selectedFriendRow.value || contactActionPending.value) {
    return
  }

  const groupTag = contactTagDraft.value.trim()
  if (!contactTagChanged.value) {
    return
  }

  contactActionPending.value = true
  contactActionError.value = ''
  try {
    await friendStore.updateFriendTag(userUuid.value, selectedFriendRow.value.peerUuid, groupTag)
  } catch (error) {
    contactActionError.value = resolveRelationErrorMessage('set_friend_tag', error)
  } finally {
    contactActionPending.value = false
  }
}

async function resetAndNavigateLogin(): Promise<void> {
  userStore.reset()
  friendStore.reset()
  presenceStore.reset()
  applyStore.reset()
  blacklistStore.reset()
  deviceStore.reset()
  contactActionError.value = ''
  contactRemarkDraft.value = ''
  contactTagDraft.value = ''
  searchKeyword.value = ''
  searchReasonDraft.value = '我是 LCchat 用户'
  searchResults.value = []
  clearSearchFeedback()
  clearScannedProfile()
  clearSentApplyFeedback()
  retryingSentApplyId.value = 0
  resetSettingsState()
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
    applyStore.loadInbox(authStore.userUuid),
    applyStore.loadSent(authStore.userUuid)
  ])

  await Promise.all([
    userStore.syncFromServer(authStore.userUuid),
    friendStore.syncFromServer(authStore.userUuid),
    blacklistStore.syncFromServer(authStore.userUuid),
    applyStore.syncInboxFromServer(authStore.userUuid),
    applyStore.syncSentFromServer(authStore.userUuid),
    applyStore.syncUnreadCountFromServer(authStore.userUuid),
    deviceStore.loadDevices().catch((error) => {
      console.warn('sync devices from server failed, keep current state', error)
    })
  ])
})

onBeforeUnmount(() => {
  disposeSettingsActions()
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
        :hint="friendListHint"
        :items="friendPaneItems"
        :groups="friendPaneGroups"
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
      >
        <template #actions>
          <div v-if="selectedFriendRow" class="contact-actions-wrap">
            <div class="contact-actions">
              <button
                type="button"
                class="action-btn action-btn--danger"
                :disabled="contactActionPending"
                @click="handleDeleteFriend"
              >
                删除好友
              </button>
              <button
                type="button"
                class="action-btn action-btn--ghost"
                :disabled="contactActionPending"
                @click="handleAddBlacklist"
              >
                加入黑名单
              </button>
            </div>

            <section class="contact-edit-card">
              <label class="contact-field">
                <span>好友备注</span>
                <input
                  v-model="contactRemarkDraft"
                  maxlength="64"
                  placeholder="输入好友备注"
                  @input="handleContactInput"
                />
              </label>
              <button
                type="button"
                class="action-btn action-btn--primary"
                :disabled="!contactRemarkChanged || contactActionPending"
                @click="handleSaveFriendRemark"
              >
                保存备注
              </button>
            </section>

            <section class="contact-edit-card">
              <label class="contact-field">
                <span>好友标签</span>
                <input
                  v-model="contactTagDraft"
                  list="friend-tag-options"
                  maxlength="32"
                  placeholder="例如：工作 / 家人 / 同学"
                  @input="handleContactInput"
                />
                <datalist id="friend-tag-options">
                  <option v-for="name in tagSuggestionNames" :key="name" :value="name" />
                </datalist>
              </label>
              <button
                type="button"
                class="action-btn action-btn--primary"
                :disabled="!contactTagChanged || contactActionPending"
                @click="handleSaveFriendTag"
              >
                保存标签
              </button>
            </section>
          </div>
          <p v-if="contactActionError" class="apply-error">{{ contactActionError }}</p>
        </template>
      </DetailPane>
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
          <ScannedUserProfileCard
            v-if="
              scannedProfile ||
              scannedProfileLoading ||
              scannedProfileError ||
              scannedProfileMessage
            "
            :profile="scannedProfile"
            :loading="scannedProfileLoading"
            :sending="sendingApplyTarget === scannedProfile?.uuid"
            :relation-blocked="scannedProfileBlocked"
            :reason-preview="searchReasonDraft"
            :existing-friend-ids="existingFriendIds"
            :blacklist-ids="blacklistPeerIds"
            :message="scannedProfileMessage"
            :error-message="scannedProfileError"
            @clear-feedback="handleScannedProfileInput"
            @send-apply="handleSendFriendApply($event, 'desktop_qrcode')"
            @close="clearScannedProfile"
          />
          <UserSearchCard
            :keyword="searchKeyword"
            :reason="searchReasonDraft"
            :results="searchResultItems"
            :searching="searchingUsers"
            :sending-target-uuid="sendingApplyTarget"
            :existing-friend-ids="existingFriendIds"
            :blacklist-ids="blacklistPeerIds"
            :message="searchMessage"
            :error-message="searchError"
            @update:keyword="searchKeyword = $event"
            @update:reason="searchReasonDraft = $event"
            @search="handleSearchUsers"
            @send-apply="handleSendFriendApply"
            @clear-feedback="handleSearchInput"
          />
          <SentApplyListCard
            :items="sentApplyItems"
            :retrying-apply-id="retryingSentApplyId"
            :message="sentApplyMessage"
            :error-message="sentApplyError"
            @retry="handleRetrySentApply"
          />
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
          <SettingsActionsPanel
            :has-selected-blacklist="!!selectedBlacklistRow"
            :selected-blacklist-label="selectedBlacklistLabel"
            :blacklist-action-pending="blacklistActionPending"
            :blacklist-action-error="blacklistActionError"
            :profile="profileEditorData"
            :profile-save-pending="profileSavePending"
            :profile-avatar-uploading="avatarUploadPending"
            :profile-save-error="profileSaveError"
            :qr-code-url="qrCode?.qrCode || ''"
            :qr-code-token="qrCode?.token || ''"
            :qr-code-expire-at="qrCode?.expireAt || ''"
            :qrcode-loading="qrcodeLoading"
            :qrcode-parsing="qrcodeParsing"
            :qrcode-message="qrcodeMessage"
            :qrcode-error="qrcodeError"
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
            @remove-blacklist="handleRemoveBlacklist"
            @profile-clear-error="handleProfileInput"
            @profile-submit="handleProfileSave"
            @profile-upload-avatar="handleProfileAvatarUpload"
            @qrcode-clear-feedback="clearQRCodeFeedback"
            @refresh-qr-code="handleLoadQRCode"
            @parse-qr-code="handleParseQRCode"
            @security-clear-feedback="clearSecurityFeedback"
            @request-email-code="handleRequestEmailCode"
            @submit-email="handleSubmitEmail"
            @submit-password="handleSubmitPassword"
            @submit-delete="handleSubmitDelete"
            @reload-devices="handleReloadDevices"
            @kick-device="handleKickDevice"
          />
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

.contact-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.contact-actions-wrap {
  display: grid;
  gap: 10px;
}

.contact-edit-card {
  border: 1px solid var(--c-border);
  border-radius: 10px;
  padding: 10px;
  background: #fff;
  display: grid;
  gap: 8px;
}

.contact-field {
  display: grid;
  gap: 6px;
}

.contact-field span {
  font-size: 12px;
  color: var(--c-text-sub);
}

.contact-field input {
  width: 100%;
  border: 1px solid var(--c-border);
  border-radius: 8px;
  padding: 7px 10px;
  font-size: 13px;
  color: var(--c-text-main);
  outline: none;
}

.contact-field input:focus {
  border-color: var(--c-primary);
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
</style>
