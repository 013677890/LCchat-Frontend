<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import UserSearchCard from '../components/UserSearchCard.vue'
import { searchUsers, sendFriendApply } from '../../contact/api'
import { useAuthStore } from '../../../stores/auth.store'
import { useFriendStore } from '../../../stores/friend.store'
import { useApplyStore } from '../../../stores/apply.store'
import { normalizeErrorMessage } from '../../../shared/utils/error'
import { resolveRelationErrorMessage } from '../../contact/error-message'
import { resolveAssetUrl } from '../../../shared/utils/asset-url'
import { toast } from 'vue-sonner'

const route = useRoute()
const authStore = useAuthStore()
const friendStore = useFriendStore()
const applyStore = useApplyStore()
const { userUuid } = storeToRefs(authStore)

const searchKeyword = ref('')
const searchReasonDraft = ref('我是 LCchat 用户')
const searchResults = ref<any[]>([])
const searchingUsers = ref(false)
const sendingApplyTarget = ref('')

watch(
  () => route.query.target,
  (newTarget) => {
    if (newTarget && typeof newTarget === 'string') {
      searchKeyword.value = newTarget
      handleSearchUsers()
    }
  },
  { immediate: true }
)

function mapSearchResult(item: any) {
  return {
    ...item,
    avatar: resolveAssetUrl(item.avatar),
    isOnline: null,
    lastSeenAt: '',
    presenceText: '未知状态'
  }
}

async function handleSearchUsers() {
  const keyword = searchKeyword.value.trim()
  if (!keyword || searchingUsers.value) return

  searchingUsers.value = true
  try {
    const response = await searchUsers({ keyword, page: 1, pageSize: 30 })
    const allItems = (response.data.items ?? []).map(mapSearchResult)
    searchResults.value = allItems.filter((item) => item.uuid && item.uuid !== userUuid.value)
    if (searchResults.value.length === 0) {
      toast.info('没有找到匹配用户')
    }
  } catch (error) {
    toast.error(normalizeErrorMessage(error))
  } finally {
    searchingUsers.value = false
  }
}

async function handleSendFriendApply(targetUuid: string) {
  if (!targetUuid || sendingApplyTarget.value || !userUuid.value) return

  sendingApplyTarget.value = targetUuid
  try {
    await sendFriendApply({
      targetUuid,
      reason: searchReasonDraft.value.trim() || undefined,
      source: 'desktop_search'
    })
    const target = searchResults.value.find((item) => item.uuid === targetUuid)?.nickname || targetUuid
    toast.success(`好友申请已发送给 ${target}`)
    await applyStore.syncSentFromServer(userUuid.value)
  } catch (error) {
    toast.error(resolveRelationErrorMessage('send_friend_apply', error))
  } finally {
    sendingApplyTarget.value = ''
  }
}
</script>

<template>
  <main class="flex-1 flex flex-col items-center bg-[var(--c-bg-panel-soft)] overflow-y-auto">
    <header class="w-full px-8 py-6 border-b border-[var(--c-border)] bg-[var(--c-bg-panel)] sticky top-0 z-10 backdrop-blur-xl mb-6">
      <h2 class="text-xl font-bold text-[var(--c-text-main)] drop-shadow-sm">发现新好友</h2>
    </header>
    
    <div class="max-w-3xl w-full p-8">
      <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8 flex gap-4">
        <input 
          v-model="searchKeyword"
          type="text"
          placeholder="搜索 UUID 或昵称..."
          @keyup.enter="handleSearchUsers"
          class="flex-1 px-4 py-3 bg-gray-50 border-transparent rounded-xl focus:bg-white focus:border-[var(--c-primary)] focus:ring-4 focus:ring-[var(--c-primary-soft)] transition-all outline-none text-sm"
        />
        <button 
          @click="handleSearchUsers" 
          :disabled="searchingUsers || !searchKeyword"
          class="px-6 py-3 bg-[var(--c-primary)] hover:bg-[var(--c-primary-active)] text-white rounded-xl font-medium transition-all shadow-sm shadow-[var(--c-primary-soft)] disabled:opacity-50 disabled:cursor-not-allowed">
          {{ searchingUsers ? '搜索中...' : '搜索' }}
        </button>
      </div>

      <UserSearchCard
        :keyword="searchKeyword"
        :reason="searchReasonDraft"
        :results="searchResults"
        :searching="searchingUsers"
        :sending-target-uuid="sendingApplyTarget"
        @update:keyword="searchKeyword = $event"
        @update:reason="searchReasonDraft = $event"
        @search="handleSearchUsers"
        @send-apply="handleSendFriendApply"
      />
    </div>
  </main>
</template>
