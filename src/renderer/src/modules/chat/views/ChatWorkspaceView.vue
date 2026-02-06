<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import ConversationPane from '../components/ConversationPane.vue'
import MessagePane from '../components/MessagePane.vue'
import SidebarNav from '../components/SidebarNav.vue'
import { useAppStore, type MainNavKey } from '../../../stores/app.store'
import { useAuthStore } from '../../../stores/auth.store'
import { useSessionStore } from '../../../stores/session.store'
import { formatConversationTime } from '../../../shared/utils/time'

interface ConversationListItem {
  convId: string
  title: string
  preview: string
  unread: number
  timeText: string
}

const router = useRouter()
const appStore = useAppStore()
const authStore = useAuthStore()
const sessionStore = useSessionStore()

const { activeNav } = storeToRefs(appStore)
const { userUuid } = storeToRefs(authStore)
const {
  conversations,
  activeConvId,
  activeConversation,
  activeMessages,
  activeDraft,
  loading,
  localDBAvailable
} =
  storeToRefs(sessionStore)

const userLabel = computed(() => userUuid.value || '匿名用户')

const activeConversationTitle = computed(() => {
  if (!activeConversation.value) {
    return '会话'
  }

  return sessionStore.getConversationTitle(activeConversation.value)
})

const conversationItems = computed<ConversationListItem[]>(() => {
  return conversations.value.map((item) => ({
    convId: item.convId,
    title: sessionStore.getConversationTitle(item),
    preview: sessionStore.getConversationPreview(item),
    unread: sessionStore.getConversationUnread(item),
    timeText: formatConversationTime(item.updatedAt)
  }))
})

async function handleNavChange(nextNav: MainNavKey): Promise<void> {
  appStore.setActiveNav(nextNav)
}

async function handleConversationSelect(convId: string): Promise<void> {
  await sessionStore.openConversation(convId)
}

async function handleDraftChange(value: string): Promise<void> {
  await sessionStore.setDraft(value)
}

async function handleSend(text: string): Promise<void> {
  await sessionStore.sendMessage(text)
}

async function handleLogout(): Promise<void> {
  await authStore.signOut()
  await sessionStore.clearState()
  await router.replace({ name: 'login' })
}

onMounted(async () => {
  await authStore.hydrateSession()
  if (!authStore.isAuthenticated) {
    await router.replace({ name: 'login' })
    return
  }

  await sessionStore.bootstrap(authStore.userUuid)
})
</script>

<template>
  <div class="workspace">
    <p v-if="!localDBAvailable" class="degrade-banner">
      本地缓存不可用，已自动降级为内存模式。
    </p>
    <SidebarNav
      :active-nav="activeNav"
      :user-label="userLabel"
      @select="handleNavChange"
      @logout="handleLogout"
    />

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
</style>
