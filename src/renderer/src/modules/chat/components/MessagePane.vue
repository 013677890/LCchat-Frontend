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

const composerTools = [
  { key: 'emoji', label: '表情', icon: ':-)' },
  { key: 'image', label: '图片', icon: 'IMG' },
  { key: 'file', label: '文件', icon: 'FILE' }
]
</script>

<template>
  <section class="message-pane">
    <header class="header">
      <div class="title-wrap">
        <h2>{{ props.title || '选择会话' }}</h2>
        <p>在线 · 草稿自动写入本地缓存</p>
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
      <div class="tool-row">
        <button v-for="tool in composerTools" :key="tool.key" type="button" :title="tool.label">
          <span>{{ tool.icon }}</span>
          <small>{{ tool.label }}</small>
        </button>
      </div>
      <div class="textarea-wrap">
        <textarea
          v-model="draftProxy"
          placeholder="输入消息，Enter 换行，点击发送提交"
          rows="4"
        />
        <button type="button" class="send-btn" @click="handleSend">发送</button>
      </div>
      <div class="composer-actions">
        <span>Enter 换行，点击发送按钮提交消息</span>
      </div>
    </footer>
  </section>
</template>

<style scoped>
.message-pane {
  flex: 1;
  min-width: 0;
  background: #f3f5f7;
  display: flex;
  flex-direction: column;
}

.header {
  min-height: 60px;
  border-bottom: 1px solid var(--c-border);
  display: flex;
  align-items: center;
  padding: 8px 20px;
  background: #fff;
}

.header h2 {
  margin: 0;
  font-size: 16px;
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
  padding: 16px 20px;
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
  border-radius: 2px 12px 12px 12px;
  padding: 10px 14px;
  background: #fff;
  border: 1px solid #e8edf2;
  box-shadow: var(--shadow-1);
}

.bubble-row--self .bubble {
  background: #95ec69;
  border-color: #84d85f;
  border-radius: 12px 2px 12px 12px;
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
  background: #eef2f5;
  border-top: 1px solid var(--c-border);
  padding: 10px 18px 12px;
}

.tool-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.tool-row button {
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--c-text-muted);
  padding: 4px 6px;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.tool-row button:hover {
  color: var(--c-text-sub);
  background: rgba(255, 255, 255, 0.8);
}

.tool-row span {
  font-size: 14px;
}

.tool-row small {
  font-size: 11px;
}

.textarea-wrap {
  position: relative;
}

.composer textarea {
  width: 100%;
  border: 1px solid #dbe1e8;
  border-radius: 12px;
  resize: none;
  padding: 11px 80px 11px 12px;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s ease-out;
}

.composer textarea:focus {
  border-color: var(--c-primary);
  box-shadow: 0 0 0 3px rgba(7, 193, 96, 0.12);
}

.send-btn {
  position: absolute;
  right: 10px;
  bottom: 10px;
  border: none;
  border-radius: 8px;
  background: var(--c-primary);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 12px;
  cursor: pointer;
}

.send-btn:hover {
  background: var(--c-primary-hover);
}

.composer-actions {
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
}

.composer-actions span {
  color: var(--c-text-muted);
  font-size: 11px;
}
</style>
