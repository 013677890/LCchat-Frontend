<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import type { MessageRow } from '../../../shared/types/localdb'
import { Copy, CornerUpLeft, MessageSquare, AlertCircle } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { renderMarkdown } from '../../../shared/utils/markdown'

const props = defineProps<{
  title: string
  messages: MessageRow[]
  draft: string
  currentUserUuid: string
  isGroup: boolean
  currentUserGroupRole: number // 0=normal, 1=admin, 2=owner
  groupMembers?: any[]
}>()

const emit = defineEmits<{
  'update:draft': [string]
  send: [string]
  recallMessage: [msgId: string]
  resendMessage: [clientMsgId: string]
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

function getSenderName(message: MessageRow): string {
  const uuid = message.payload.fromUuid as string
  if (!uuid) return '未知'
  if (props.groupMembers) {
    const member = props.groupMembers.find(m => m.userUuid === uuid)
    if (member) {
      return member.groupNickname || member.nickname || uuid.substring(0, 8)
    }
  }
  return uuid.substring(0, 8)
}

function handleSend(): void {
  const text = draftProxy.value.trim()
  if (!text) {
    return
  }

  emit('send', text)
}

// ------ Permission Aware Recall Logic ------
function canRecall(message: MessageRow): boolean {
  if (message.status === 1) return false // Already recalled
  
  // Rule 1: Self message can be recalled within 2 minutes (120,000 milliseconds)
  const isSelf = message.payload.fromUuid === props.currentUserUuid
  const timeLimitPassed = Date.now() - message.sendTime < 120000
  if (isSelf && timeLimitPassed) {
    return true
  }

  // Rule 2: In a group, group owner/admin (role >= 1) can recall ANY member's message at any time
  if (props.isGroup && props.currentUserGroupRole >= 1) {
    return true
  }

  return false
}

// Context Menu State
const showMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const menuTargetMsgId = ref('')
const menuTargetText = ref('')
const menuTargetCanRecall = ref(false)

function openMessageMenu(event: MouseEvent, message: MessageRow) {
  if (message.status === 1) return // No menu for recalled messages
  
  event.preventDefault()
  menuTargetMsgId.value = message.msgId
  menuTargetText.value = getText(message)
  menuTargetCanRecall.value = canRecall(message)
  
  const menuWidth = 140
  const menuHeight = 80
  let x = event.clientX
  let y = event.clientY
  
  if (x + menuWidth > window.innerWidth) {
    x = window.innerWidth - menuWidth - 10
  }
  if (y + menuHeight > window.innerHeight) {
    y = window.innerHeight - menuHeight - 10
  }
  
  menuX.value = x
  menuY.value = y
  showMenu.value = true
}

function closeMessageMenu() {
  showMenu.value = false
}

function handleOutsideClick() {
  if (showMenu.value) {
    closeMessageMenu()
  }
}

onMounted(() => {
  window.addEventListener('click', handleOutsideClick)
  window.addEventListener('contextmenu', handleOutsideClick)
})

onUnmounted(() => {
  window.removeEventListener('click', handleOutsideClick)
  window.removeEventListener('contextmenu', handleOutsideClick)
})

async function triggerCopy() {
  try {
    await navigator.clipboard.writeText(menuTargetText.value)
    toast.success('已复制到剪贴板')
  } catch (err) {
    toast.error('复制失败，请尝试手动复制')
  }
  closeMessageMenu()
}

function triggerRecall() {
  emit('recallMessage', menuTargetMsgId.value)
  closeMessageMenu()
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function processFiles(files: FileList) {
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (!file) continue
    
    // Detect typical text/developer file extensions
    const isText = file.type.startsWith('text/') || 
                   /\.(txt|md|json|js|ts|jsx|tsx|html|css|py|go|rs|c|cpp|h|sh|yml|yaml|xml)$/i.test(file.name)
                   
    if (isText) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result
        if (typeof content === 'string') {
          const header = `\n--- 文件: ${file.name} ---\n`
          draftProxy.value = (draftProxy.value ? draftProxy.value + '\n' : '') + header + content + '\n'
          toast.success(`成功导入文本文件: ${file.name}`)
        }
      }
      reader.onerror = () => {
        toast.error(`读取文件失败: ${file.name}`)
      }
      reader.readAsText(file)
    } else {
      // Elegant glassmorphic feedback for media/binary files
      toast.info(`“${file.name}” 是媒体/二进制文件。为了保障端到端加密通道的安全与速度，目前仅支持文本消息发送，已为您提取该文件的基本信息。`, {
        duration: 5000
      })
      draftProxy.value = (draftProxy.value ? draftProxy.value + ' ' : '') + `[文件: ${file.name} (${formatBytes(file.size)})]`
    }
  }
}

function handlePaste(event: ClipboardEvent) {
  const items = event.clipboardData?.items
  if (!items) return

  const files: File[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (!item) continue
    const file = item.getAsFile()
    if (file) {
      files.push(file)
    }
  }

  if (files.length > 0) {
    event.preventDefault()
    const dataTransfer = new DataTransfer()
    files.forEach(f => dataTransfer.items.add(f))
    processFiles(dataTransfer.files)
  }
}

function handleDrop(event: DragEvent) {
  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    processFiles(files)
  }
}

function emitResend(clientMsgId: string | undefined) {
  if (clientMsgId) {
    emit('resendMessage', clientMsgId)
  }
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
      <!-- slot injection point for ChatView extra controls -->
      <div class="actions-slot-wrap">
        <slot name="header-actions" />
      </div>
    </header>

    <main class="history">
      <p v-if="props.messages.length === 0" class="empty">暂无消息，发送一条开始聊天。</p>
      <div v-else class="message-list">
        <template v-for="message in props.messages" :key="message.msgId">
          <!-- A. Recalled System notice -->
          <div v-if="message.status === 1" class="recalled-notice">
            <span>{{ getText(message) }}</span>
          </div>

          <!-- B. Normal Chat Bubble -->
          <article
            v-else
            class="bubble-row"
            :class="{ 'bubble-row--self': getFrom(message) === 'self' }"
          >
            <div class="bubble-container">
              <span v-if="props.isGroup && getFrom(message) === 'peer'" class="sender-name">
                {{ getSenderName(message) }}
              </span>
              <div class="bubble-wrapper">
                <button
                  v-if="message.status === -1"
                  type="button"
                  class="failed-retry-btn"
                  title="发送失败，点击重新发送"
                  @click="emitResend(message.clientMsgId)"
                >
                  <AlertCircle class="alert-icon" :size="18" />
                </button>
                <div 
                  class="bubble"
                  @contextmenu="openMessageMenu($event, message)"
                >
                  <p class="message-content-html" v-html="renderMarkdown(getText(message))"></p>
                  <time>{{ getTime(message) }}</time>
                </div>
              </div>
            </div>
          </article>
        </template>
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
          placeholder="输入消息，Enter 换行，点击发送提交，支持拖拽或粘贴文本文件..."
          rows="4"
          @paste="handlePaste"
          @drop.prevent="handleDrop"
          @dragover.prevent
        />
        <button type="button" class="send-btn" @click="handleSend">发送</button>
      </div>
      <div class="composer-actions">
        <span>Enter 换行，点击发送按钮提交消息</span>
      </div>
    </footer>

    <!-- Glassmorphic Message Context Menu -->
    <teleport to="body">
      <transition name="fade-menu">
        <div
          v-if="showMenu"
          class="context-menu"
          :style="{ left: menuX + 'px', top: menuY + 'px' }"
          @click.stop
        >
          <button type="button" class="menu-item" @click="triggerCopy">
            <Copy :size="13" class="icon" />
            <span>复制文本</span>
          </button>
          <button
            v-if="menuTargetCanRecall"
            type="button"
            class="menu-item menu-item--danger"
            @click="triggerRecall"
          >
            <CornerUpLeft :size="13" class="icon text-red-500" />
            <span class="text-red-500">撤回该消息</span>
          </button>
        </div>
      </transition>
    </teleport>
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

.header {
  min-height: 64px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  display: flex;
  align-items: center;
  justify-content: space-between;
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

.actions-slot-wrap {
  display: flex;
  align-items: center;
}

.history {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
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

.bubble-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: min(75%, 600px);
}

.bubble-row--self .bubble-container {
  align-items: flex-end;
}

.bubble-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bubble-row--self .bubble-wrapper {
  flex-direction: row;
}

.bubble-row:not(.bubble-row--self) .bubble-wrapper {
  flex-direction: row-reverse;
}

.failed-retry-btn {
  border: none;
  background: transparent;
  padding: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  transition: background var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--ease-out);
}

.failed-retry-btn:hover {
  background: rgba(239, 68, 68, 0.08);
  transform: scale(1.15);
}

.failed-retry-btn:active {
  transform: scale(0.9);
}

.alert-icon {
  color: #ef4444;
  animation: heartBeat 2s infinite ease-in-out;
}

@keyframes heartBeat {
  0% { transform: scale(1); }
  50% { transform: scale(1.12); opacity: 0.85; }
  100% { transform: scale(1); }
}

.sender-name {
  font-size: 11px;
  color: var(--c-text-sub);
  margin-left: 2px;
  font-weight: 500;
}

.bubble {
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
  box-shadow: 0 6px 16px rgba(0, 198, 112, 0.15), 0 2px 4px rgba(0, 198, 112, 0.08);
  border: none;
}

.bubble p {
  margin: 0;
  color: inherit;
  line-height: 1.6;
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-word;
}

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

.recalled-notice {
  display: flex;
  justify-content: center;
  margin: 6px 0;
  animation: fadeIn 0.2s ease-out;
}

.recalled-notice span {
  font-size: 11px;
  color: var(--c-text-muted);
  background: rgba(0, 0, 0, 0.03);
  padding: 4px 12px;
  border-radius: var(--radius-full);
  user-select: none;
}

.empty {
  margin: 0;
  text-align: center;
  color: var(--c-text-muted);
  font-size: 14px;
  padding-top: 40px;
}

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

/* Glassmorphic Context Menu */
.context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 130px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: var(--radius-md);
  padding: 4px;
  box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.12), 0 8px 12px -6px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.menu-item {
  width: 100%;
  border: none;
  background: transparent;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--c-text-main);
  font-size: 12px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.menu-item:hover {
  background: var(--c-primary-soft);
  color: var(--c-primary-active);
}

.menu-item .icon {
  flex-shrink: 0;
  color: var(--c-text-sub);
}

.menu-item:hover .icon {
  color: var(--c-primary-active);
}

.menu-item--danger {
  color: var(--c-danger);
}

.menu-item--danger:hover {
  background: rgba(239, 68, 68, 0.08);
}

.menu-item--danger .icon {
  color: var(--c-danger);
}

.fade-menu-enter-active,
.fade-menu-leave-active {
  transition: opacity 0.12s ease, transform 0.12s cubic-bezier(0.16, 1, 0.3, 1);
}

.fade-menu-enter-from {
  opacity: 0;
  transform: scale(0.96) translateY(-4px);
}

.fade-menu-leave-to {
  opacity: 0;
  transform: scale(0.98);
}


@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Markdown Content Styling */
.bubble p.message-content-html {
  white-space: normal;
}

/* Multiline Code Block */
:deep(.code-block) {
  background: rgba(30, 33, 38, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  margin: 8px 0;
  overflow-x: auto;
  font-family: 'Fira Code', 'Cascadia Code', Consolas, Monaco, monospace;
  font-size: 13px;
  text-align: left;
}

:deep(.code-block code) {
  color: #a9b1d6;
}

.bubble-row--self :deep(.code-block) {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.bubble-row--self :deep(.code-block code) {
  color: #e2f9ee;
}

/* Inline Code Snippets */
:deep(.code-inline) {
  background: rgba(0, 0, 0, 0.05);
  color: var(--c-danger);
  border-radius: var(--radius-sm);
  padding: 2px 6px;
  font-family: 'Fira Code', Consolas, monospace;
  font-size: 13px;
}

.bubble-row--self :deep(.code-inline) {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

/* Markdown Hyperlinks */
:deep(.markdown-link) {
  color: var(--c-primary);
  text-decoration: underline;
  font-weight: 500;
}

.bubble-row--self :deep(.markdown-link) {
  color: #e2f9ee;
  text-decoration: underline;
}
</style>
