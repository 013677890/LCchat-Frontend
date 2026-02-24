<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import ListPane from '../components/ListPane.vue'
import DetailPane from '../components/DetailPane.vue'
import { useFriendStore } from '../../../stores/friend.store'
import { useApplyStore } from '../../../stores/apply.store'
import { useBlacklistStore } from '../../../stores/blacklist.store'
import { usePresenceStore } from '../../../stores/presence.store'
import { useAuthStore } from '../../../stores/auth.store'
import { buildFriendGroups } from '../utils/friend-grouping'

const authStore = useAuthStore()
const friendStore = useFriendStore()
const applyStore = useApplyStore()
const blacklistStore = useBlacklistStore()
const presenceStore = usePresenceStore()

const { friends, tagSuggestions } = storeToRefs(friendStore)
const { inbox: applyInbox, sent: sentApplies, unreadCount, unreadCountSynced } = storeToRefs(applyStore)
const { items: blacklistItems } = storeToRefs(blacklistStore)
const { statusByUserUuid } = storeToRefs(presenceStore)
const { userUuid } = storeToRefs(authStore)

const selectedFriendId = ref('')
const selectedApplyId = ref('')
const selectedBlacklistId = ref('')
const contactActionError = ref('')

function handleFriendSelect(id: string) {
  contactActionError.value = ''
  selectedFriendId.value = id
}
function handleApplySelect(id: string) {
  selectedApplyId.value = id
}
function handleBlacklistSelect(id: string) {
  selectedBlacklistId.value = id
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

// Very basic wiring to keep typescript happy and layout visible
const friendPaneItems = computed<PaneItem[]>(() => friends.value.map(row => ({
  id: row.peerUuid,
  title: String(row.payload?.remark || row.payload?.nickname || row.peerUuid),
  subtitle: '状态未知',
  online: false,
  groupTag: String(row.payload?.groupTag || '未分组')
})))

const tagSuggestionNames = computed(() => tagSuggestions.value.map(item => String(item.tagName)))
const friendPaneGroups = computed(() => buildFriendGroups(friendPaneItems.value as any, tagSuggestionNames.value) as any)
const friendListHint = computed(() => `${friendPaneItems.value.length} 位好友`)

const applyPaneItems = computed(() => applyInbox.value.map(row => ({
  id: String(row.applyId),
  title: String(row.payload?.applicantNickname || row.payload?.applicantUuid),
  subtitle: String(row.payload?.reason || '无申请附言'),
  badge: row.payload?.isRead ? 0 : 1
})))

const blacklistPaneItems = computed(() => blacklistItems.value.map(row => ({
  id: row.peerUuid,
  title: String(row.payload?.nickname || row.peerUuid),
  subtitle: row.peerUuid
})))

const localUnreadApplyCount = computed(() => applyInbox.value.reduce((count, row) => count + (row.payload?.isRead ? 0 : 1), 0))
const unreadApplyCountComputed = computed(() => unreadCountSynced.value ? unreadCount.value : localUnreadApplyCount.value)


</script>

<template>
  <div class="flex h-full w-full">
    <aside class="w-[320px] min-w-[320px] flex flex-col bg-[var(--c-bg-panel)] h-full border-r border-white/50 backdrop-blur-xl">
      <ListPane
        title="好友列表"
        :hint="friendListHint"
        :items="friendPaneItems"
        :groups="friendPaneGroups"
        empty-text="暂无通讯录数据"
        :selected-id="selectedFriendId"
        @select="handleFriendSelect"
      />
    </aside>
    <main class="flex-1 flex flex-col min-w-0 h-full bg-[var(--c-bg-panel-soft)] relative">
      <div v-if="!selectedFriendId" class="flex-1 flex flex-col items-center justify-center text-[var(--c-text-muted)] gap-4">
        <div class="w-16 h-16 rounded-2xl bg-black/5 grid place-items-center text-2xl">C</div>
        <p>未选择联系人</p>
      </div>
      <DetailPane v-else title="联系人详情" :lines="[]" />
    </main>
  </div>
</template>
