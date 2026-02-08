<script setup lang="ts">
import { computed } from 'vue'
import type { MessageRow } from '../../../shared/types/localdb'

const props = defineProps<{
  title: string
  messages: MessageRow[]
  draft: string
}>()

const emit = defineEmits<{
  'update:draft': [string]
  send: [string]
}>()

const draftProxy = computed({
  get: () => props.draft,
  set: (value: string) => emit('update:draft', value)
})

function getText(message: MessageRow): string {
  const value = message.payload.text
  return typeof value === 'string' ? value : ''
}

function getFrom(message: MessageRow): 'self' | 'peer' {
  const value = message.payload.from
  return value === 'self' ? 'self' : 'peer'
}

function getTime(message: MessageRow): string {
  return new Date(message.sendTime).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

function handleSend(): void {
  const text = draftProxy.value.trim()
  if (!text) {
    return
  }

  emit('send', text)
}
</script>

<template>
  <section class="message-pane">
    <header class="header">
      <div class="title-wrap">
        <h2>{{ props.title || '选择会话' }}</h2>
        <p>消息实时写入本地缓存，重启后保留草稿与会话视图。</p>
      </div>
    </header>

    <main class="history">
      <p v-if="props.messages.length === 0" class="empty">暂无消息，发送一条开始聊天。</p>
      <div v-else class="message-list">
        <article
          v-for="message in props.messages"
          :key="message.msgId"
          class="bubble-row"
          :class="{ 'bubble-row--self': getFrom(message) === 'self' }"
        >
          <div class="bubble">
            <p>{{ getText(message) }}</p>
            <time>{{ getTime(message) }}</time>
          </div>
        </article>
      </div>
    </main>

    <footer class="composer">
      <textarea v-model="draftProxy" placeholder="输入消息，Enter 换行，点击发送提交" rows="4" />
      <div class="composer-actions">
        <span>草稿自动写入本地 SQLite</span>
        <button type="button" @click="handleSend">发送</button>
      </div>
    </footer>
  </section>
</template>

<style scoped>
.message-pane {
  flex: 1;
  min-width: 0;
  background:
    radial-gradient(500px 260px at 0% 0%, rgba(8, 182, 98, 0.08), transparent 70%),
    linear-gradient(180deg, #f6faf8 0%, #f1f6f3 100%);
  display: flex;
  flex-direction: column;
}

.header {
  min-height: 76px;
  border-bottom: 1px solid var(--c-border);
  display: flex;
  align-items: center;
  padding: 14px 20px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(4px);
}

.header h2 {
  margin: 0;
  font-size: 17px;
  color: var(--c-text-main);
}

.title-wrap p {
  margin: 5px 0 0;
  font-size: 11px;
  color: var(--c-text-muted);
}

.history {
  flex: 1;
  overflow-y: auto;
  padding: 18px 20px;
}

.message-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bubble-row {
  display: flex;
  justify-content: flex-start;
}

.bubble-row--self {
  justify-content: flex-end;
}

.bubble {
  max-width: min(70%, 540px);
  border-radius: 14px;
  padding: 10px 13px;
  background: #fff;
  border: 1px solid var(--c-border);
  box-shadow: var(--shadow-1);
}

.bubble-row--self .bubble {
  background: #dcf6e7;
  border-color: rgba(8, 182, 98, 0.3);
}

.bubble p {
  margin: 0;
  color: var(--c-text-main);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.bubble time {
  display: block;
  text-align: right;
  margin-top: 4px;
  color: var(--c-text-muted);
  font-size: 11px;
}

.empty {
  margin: 0;
  color: var(--c-text-muted);
  font-size: 13px;
}

.composer {
  background: rgba(255, 255, 255, 0.92);
  border-top: 1px solid var(--c-border);
  padding: 14px 18px;
  backdrop-filter: blur(4px);
}

.composer textarea {
  width: 100%;
  border: 1px solid var(--c-border-strong);
  border-radius: 12px;
  resize: none;
  padding: 11px 12px;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s ease-out;
}

.composer textarea:focus {
  border-color: var(--c-primary);
  box-shadow: 0 0 0 3px rgba(8, 182, 98, 0.12);
}

.composer-actions {
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.composer-actions span {
  color: var(--c-text-muted);
  font-size: 12px;
}

.composer-actions button {
  border: none;
  border-radius: 10px;
  background: linear-gradient(180deg, #1ac36f 0%, #089a55 100%);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 18px;
  cursor: pointer;
  transition: background-color 0.15s ease-out;
  box-shadow: var(--shadow-1);
}

.composer-actions button:hover {
  background: linear-gradient(180deg, #17b867 0%, #078a4d 100%);
}
</style>
