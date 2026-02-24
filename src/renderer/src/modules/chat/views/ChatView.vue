<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import ConversationPane from '../components/ConversationPane.vue'
import MessagePane from '../components/MessagePane.vue'
import { useSessionStore } from '../../../stores/session.store'

const sessionStore = useSessionStore()
const {
  conversations,
  activeConvId,
  activeConversation,
  activeMessages,
  activeDraft,
  loading,
  localDBAvailable
} = storeToRefs(sessionStore)

const activeConversationTitle = computed(() => {
  if (!activeConversation.value) return '会话'
  return sessionStore.getConversationTitle(activeConversation.value)
})

async function handleConversationSelect(convId: string) {
  await sessionStore.openConversation(convId)
}

async function handleDraftChange(value: string) {
  await sessionStore.setDraft(value)
}

async function handleSend(text: string) {
  await sessionStore.sendMessage(text)
}
</script>

<template>
  <!-- List Pane -->
  <aside class="w-[320px] min-w-[320px] flex flex-col bg-[var(--c-bg-panel)] h-full border-r border-white/50 backdrop-blur-xl">
    <ConversationPane
      :items="conversations.map(c => ({
        convId: c.convId,
        title: sessionStore.getConversationTitle(c),
        preview: sessionStore.getConversationPreview(c),
        unread: sessionStore.getConversationUnread(c),
        timeText: '' // todo format time
      }))"
      :active-conv-id="activeConvId"
      :loading="loading"
      :local-db-available="localDBAvailable"
      @select="handleConversationSelect"
    />
  </aside>

  <!-- Detail Pane -->
  <main class="flex-1 flex flex-col min-w-0 h-full bg-[var(--c-bg-panel-soft)]">
    <MessagePane
      v-if="activeConvId"
      :conversation="activeConversation"
      :title="activeConversationTitle"
      :messages="activeMessages"
      :draft="activeDraft"
      @update-draft="handleDraftChange"
      @send="handleSend"
    />
    <div v-else class="flex-1 flex flex-col items-center justify-center text-[var(--c-text-muted)] gap-4">
      <div class="w-16 h-16 rounded-2xl bg-black/5 grid place-items-center text-2xl">M</div>
      <p>未选择任何会话</p>
    </div>
  </main>
</template>
