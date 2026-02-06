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
  return new Date(message.sendTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
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
      <h2>{{ props.title || '选择会话' }}</h2>
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
      <textarea
        v-model="draftProxy"
        placeholder="输入消息，Enter 换行，点击发送提交"
        rows="4"
      />
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
  background: linear-gradient(180deg, #f7f8f9 0%, #f2f3f5 100%);
  display: flex;
  flex-direction: column;
}

.header {
  height: 64px;
  border-bottom: 1px solid var(--c-border);
  display: flex;
  align-items: center;
  padding: 0 20px;
  background: #fff;
}

.header h2 {
  margin: 0;
  font-size: 16px;
  color: var(--c-text-main);
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
  border-radius: 12px;
  padding: 10px 12px;
  background: #fff;
  box-shadow: var(--shadow-1);
}

.bubble-row--self .bubble {
  background: #d5f4e1;
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
  background: #fff;
  border-top: 1px solid var(--c-border);
  padding: 14px 18px;
}

.composer textarea {
  width: 100%;
  border: 1px solid var(--c-border);
  border-radius: 10px;
  resize: none;
  padding: 10px 12px;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s ease-out;
}

.composer textarea:focus {
  border-color: var(--c-primary);
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
  border-radius: 8px;
  background: var(--c-primary);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 16px;
  cursor: pointer;
  transition: background-color 0.15s ease-out;
}

.composer-actions button:hover {
  background: var(--c-primary-hover);
}
</style>
