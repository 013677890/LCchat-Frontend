<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Bell, BellOff, Pin, PinOff, Trash2 } from 'lucide-vue-next'
import SkeletonLoader from '../../../shared/components/SkeletonLoader.vue'

interface ConversationListItem {
  convId: string
  title: string
  preview: string
  unread: number
  timeText: string
  mute: boolean
  pin: boolean
}

const props = defineProps<{
  items: ConversationListItem[]
  activeConvId: string
  loading: boolean
}>()

const emit = defineEmits<{
  select: [string]
  pin: [convId: string, pin: boolean]
  mute: [convId: string, mute: boolean]
  delete: [convId: string]
}>()

function handleSelect(convId: string): void {
  emit('select', convId)
}

// Right-click Context Menu State
const showMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const menuTargetConvId = ref('')
const menuTargetPin = ref(false)
const menuTargetMute = ref(false)

function openContextMenu(event: MouseEvent, item: ConversationListItem) {
  event.preventDefault()
  menuTargetConvId.value = item.convId
  menuTargetPin.value = item.pin
  menuTargetMute.value = item.mute
  
  const menuWidth = 150
  const menuHeight = 120
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

function closeContextMenu() {
  showMenu.value = false
}

function handleOutsideClick() {
  if (showMenu.value) {
    closeContextMenu()
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

function triggerPin() {
  emit('pin', menuTargetConvId.value, !menuTargetPin.value)
  closeContextMenu()
}

function triggerMute() {
  emit('mute', menuTargetConvId.value, !menuTargetMute.value)
  closeContextMenu()
}

function triggerDelete() {
  emit('delete', menuTargetConvId.value)
  closeContextMenu()
}
</script>

<template>
  <section class="conversations">
    <header class="header">
      <div>
        <h1>会话</h1>
        <p class="header-desc">最近消息与未读提醒</p>
      </div>
      <span class="hint">{{ props.items.length }} 条</span>
    </header>

    <SkeletonLoader v-if="props.loading" type="chat" :count="5" />
    <ul v-else-if="props.items.length > 0" class="list">
      <li v-for="item in props.items" :key="item.convId">
        <button
          class="item"
          :class="{ 
            'item--active': props.activeConvId === item.convId,
            'item--pinned': item.pin
          }"
          type="button"
          @click="handleSelect(item.convId)"
          @contextmenu="openContextMenu($event, item)"
        >
          <div class="item-head">
            <div class="title-wrap">
              <Pin v-if="item.pin" :size="12" class="pin-icon" />
              <strong>{{ item.title }}</strong>
            </div>
            <span>{{ item.timeText }}</span>
          </div>
          <div class="item-body">
            <p>{{ item.preview || '暂无消息' }}</p>
            <div class="status-wrap">
              <BellOff v-if="item.mute" :size="12" class="mute-icon" />
              <small v-if="item.unread > 0" :class="{ 'unread--muted': item.mute }">
                {{ item.unread }}
              </small>
            </div>
          </div>
        </button>
      </li>
    </ul>
    <p v-else class="empty">暂无会话</p>

    <!-- Floating Glassmorphic Context Menu -->
    <teleport to="body">
      <transition name="fade-menu">
        <div
          v-if="showMenu"
          class="context-menu"
          :style="{ left: menuX + 'px', top: menuY + 'px' }"
          @click.stop
        >
          <button type="button" class="menu-item" @click="triggerPin">
            <PinOff v-if="menuTargetPin" :size="13" class="icon" />
            <Pin v-else :size="13" class="icon" />
            <span>{{ menuTargetPin ? '取消置顶' : '会话置顶' }}</span>
          </button>
          <button type="button" class="menu-item" @click="triggerMute">
            <Bell v-if="menuTargetMute" :size="13" class="icon" />
            <BellOff v-else :size="13" class="icon" />
            <span>{{ menuTargetMute ? '接收新消息提醒' : '消息免打扰' }}</span>
          </button>
          <div class="menu-divider" />
          <button type="button" class="menu-item menu-item--danger" @click="triggerDelete">
            <Trash2 :size="13" class="icon" />
            <span>删除该会话</span>
          </button>
        </div>
      </transition>
    </teleport>
  </section>
</template>

<style scoped>
.conversations {
  width: 100%;
  height: 100%;
  background: transparent;
  display: flex;
  flex-direction: column;
}

.header {
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--c-bg-panel);
  border-bottom: 1px solid var(--c-border);
}

.header h1 {
  font-size: 18px;
  margin: 0;
  font-weight: 700;
  color: var(--c-text-main);
}

.header-desc {
  margin: 4px 0 0;
  color: var(--c-text-sub);
  font-size: 11px;
}

.hint {
  font-size: 11px;
  font-weight: 600;
  color: var(--c-primary);
  border: 1px solid var(--c-primary-soft);
  border-radius: var(--radius-full);
  padding: 4px 10px;
  background: var(--c-primary-soft);
}

.list {
  list-style: none;
  margin: 0;
  padding: 8px 12px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.item {
  width: 100%;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  text-align: left;
  cursor: pointer;
  padding: 12px;
  min-height: 72px;
  transition: all var(--duration-fast) var(--ease-out);
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.item:hover {
  background: var(--c-bg-panel-soft);
  transform: translateY(-1px);
}

.item--active {
  background: var(--c-primary-soft);
  border-color: rgba(0, 198, 112, 0.1);
  box-shadow: 0 4px 12px rgba(0, 198, 112, 0.06);
}

.item--active:hover {
  background: rgba(0, 198, 112, 0.16);
  transform: none;
}

.item--pinned {
  background: rgba(0, 0, 0, 0.02);
  border-left: 3px solid var(--c-primary);
}

.item--pinned.item--active {
  background: var(--c-primary-soft);
}

.item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  gap: 8px;
}

.title-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.pin-icon {
  color: var(--c-primary);
  flex-shrink: 0;
}

.item-head strong {
  color: var(--c-text-main);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-head span {
  color: var(--c-text-sub);
  font-size: 11px;
  white-space: nowrap;
}

.item--active .item-head strong {
  color: var(--c-primary-active);
}

.item-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.item-body p {
  margin: 0;
  color: var(--c-text-sub);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.status-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.mute-icon {
  color: var(--c-text-muted);
}

.item-body small {
  min-width: 18px;
  height: 18px;
  border-radius: var(--radius-full);
  padding: 0 5px;
  display: inline-grid;
  place-items: center;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  background: var(--c-danger);
  box-shadow: 0 2px 6px rgba(255, 77, 79, 0.2);
}

.item-body small.unread--muted {
  background: #cbd5e1 !important; /* Slate 300 */
  color: #64748b !important;
  box-shadow: none !important;
}

.empty {
  margin: 0;
  padding: 32px 16px;
  text-align: center;
  color: var(--c-text-muted);
  font-size: 13px;
}

/* Glassmorphic Context Menu Styling */
.context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 150px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: var(--radius-md);
  padding: 6px;
  box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.12), 0 8px 12px -6px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.menu-item {
  width: 100%;
  border: none;
  background: transparent;
  padding: 8px 12px;
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

.menu-divider {
  height: 1px;
  background: rgba(0, 0, 0, 0.06);
  margin: 4px 6px;
}

.menu-item--danger {
  color: var(--c-danger);
}

.menu-item--danger:hover {
  background: rgba(239, 68, 68, 0.1);
  color: var(--c-danger);
}

.menu-item--danger .icon {
  color: var(--c-danger);
}

/* Animations */
.fade-menu-enter-active,
.fade-menu-leave-active {
  transition: opacity 0.15s ease, transform 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}

.fade-menu-enter-from {
  opacity: 0;
  transform: scale(0.95) translateY(-5px);
}

.fade-menu-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>
