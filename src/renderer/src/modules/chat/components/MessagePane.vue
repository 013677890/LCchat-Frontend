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
  background: var(--c-bg-app);
  display: flex;
  flex-direction: column;
  position: relative;
}

/* 顶部 Header：增加毛玻璃吸顶效果 */
.header {
  min-height: 64px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  display: flex;
  align-items: center;
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: var(--blur-md);
  -webkit-backdrop-filter: var(--blur-md);
  position: sticky;
  top: 0;
  z-index: 10;
}

.header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--c-text-main);
}

.title-wrap p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--c-text-sub);
}

.history {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  /* 为底部预留一些空间 */
  padding-bottom: 40px;
}

.message-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.bubble-row {
  display: flex;
  justify-content: flex-start;
  animation: slideUp 0.3s var(--ease-out) forwards;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.bubble-row--self {
  justify-content: flex-end;
}

/* 消息气泡现代化重写 */
.bubble {
  max-width: min(75%, 600px);
  border-radius: var(--radius-lg) var(--radius-lg) var(--radius-lg) 4px;
  padding: 12px 16px;
  background: var(--c-bg-panel-solid);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0, 0, 0, 0.04);
  position: relative;
  transition: transform var(--duration-fast) var(--ease-out);
}

.bubble:hover {
  transform: translateY(-1px);
}

.bubble-row--self .bubble {
  background: linear-gradient(135deg, var(--c-primary) 0%, #00AE62 100%);
  color: #fff;
  border-radius: var(--radius-lg) var(--radius-lg) 4px var(--radius-lg);
  box-shadow: 0 6px 16px rgba(0, 198, 112, 0.2), 0 2px 4px rgba(0, 198, 112, 0.1);
  border: none;
}

.bubble p {
  margin: 0;
  color: inherit; /* 继承外层由于 --self 改变的颜色 */
  line-height: 1.6;
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-word;
}

/* 对方的字体颜色 */
.bubble-row:not(.bubble-row--self) .bubble p {
  color: var(--c-text-main);
}

.bubble time {
  display: block;
  text-align: right;
  margin-top: 6px;
  font-size: 11px;
  opacity: 0.6;
}

.empty {
  margin: 0;
  text-align: center;
  color: var(--c-text-muted);
  font-size: 14px;
  padding-top: 40px;
}

/* 底部输入框：去除边框，打造悬浮在底部的组件感 */
.composer {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: var(--blur-md);
  -webkit-backdrop-filter: var(--blur-md);
  border-top: 1px solid rgba(0, 0, 0, 0.04);
  padding: 12px 24px 16px;
}

.tool-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.tool-row button {
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--c-text-sub);
  padding: 6px 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.tool-row button:hover {
  color: var(--c-text-main);
  background: var(--c-bg-hover);
  transform: translateY(-1px);
}

.tool-row span {
  font-size: 16px;
  font-weight: 600;
}

.tool-row small {
  font-size: 12px;
  font-weight: 500;
}

.textarea-wrap {
  position: relative;
}

.composer textarea {
  width: 100%;
  border: 1.5px solid transparent;
  border-radius: var(--radius-lg);
  background: #f4f6f8;
  resize: none;
  padding: 14px 90px 14px 16px;
  font-size: 15px;
  font-family: inherit;
  outline: none;
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.02);
}

.composer textarea:focus {
  background: #fff;
  border-color: var(--c-primary-soft);
  box-shadow: 0 0 0 4px var(--c-primary-soft);
}

.composer textarea::placeholder {
  color: var(--c-text-muted);
}

.send-btn {
  position: absolute;
  right: 12px;
  bottom: 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--c-primary);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  padding: 8px 16px;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(0, 198, 112, 0.3);
  transition: all var(--duration-fast) var(--ease-spring);
}

.send-btn:hover {
  background: var(--c-primary-hover);
  transform: translateY(-2px);
  box-shadow: 0 6px 14px rgba(0, 198, 112, 0.4);
}

.send-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(0, 198, 112, 0.3);
}

.composer-actions {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.composer-actions span {
  color: var(--c-text-muted);
  font-size: 12px;
}
</style>
