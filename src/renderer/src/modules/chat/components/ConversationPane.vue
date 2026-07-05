<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Bell, BellOff, Pin, PinOff, Trash2, Search, X, Users } from 'lucide-vue-next'
import SkeletonLoader from '../../../shared/components/SkeletonLoader.vue'
import { avatarInitial, avatarPaletteFromId } from '../../../shared/utils/avatar'

interface ConversationListItem {
  convId: string
  title: string
  preview: string
  unread: number
  timeText: string
  mute: boolean
  pin: boolean
  /** 头像 URL，空则回退首字色块 */
  avatar?: string
  /** 群聊标识：展示群角标 */
  isGroup?: boolean
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

const searchQuery = ref('')

const filteredItems = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return props.items
  return props.items.filter(item => 
    item.title.toLowerCase().includes(query) || 
    item.preview.toLowerCase().includes(query)
  )
})

function handleSelect(convId: string): void {
  emit('select', convId)
}

// 未读数封顶展示：超过 99 显示 99+，避免撑破徽标。
function formatUnread(unread: number): string {
  return unread > 99 ? '99+' : String(unread)
}

// 无头像图时的首字色块：按 convId 稳定着色
function avatarStyle(item: ConversationListItem): Record<string, string> {
  const palette = avatarPaletteFromId(item.convId)
  return { background: palette.bg, color: palette.fg }
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

    <!-- Glassmorphic Sidebar Search Box -->
    <div class="search-box">
      <div class="search-inner">
        <Search :size="14" class="search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索会话名称或预览内容..."
          class="search-input"
        />
        <button
          v-if="searchQuery"
          type="button"
          class="search-clear-btn"
          title="清除搜索"
          @click="searchQuery = ''"
        >
          <X :size="14" />
        </button>
      </div>
    </div>

    <SkeletonLoader v-if="props.loading" type="chat" :count="5" />
    <template v-else>
      <ul v-if="filteredItems.length > 0" class="list">
        <li v-for="item in filteredItems" :key="item.convId">
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
            <!-- 头像列 -->
            <div class="item-avatar-wrap">
              <img v-if="item.avatar" :src="item.avatar" class="item-avatar" alt="" />
              <span v-else class="item-avatar item-avatar--initial" :style="avatarStyle(item)">
                {{ avatarInitial(item.title) }}
              </span>
              <span v-if="item.isGroup" class="group-badge" title="群聊">
                <Users :size="9" />
              </span>
            </div>

            <div class="item-main">
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
                    {{ formatUnread(item.unread) }}
                  </small>
                </div>
              </div>
            </div>
          </button>
        </li>
      </ul>
      <div v-else-if="searchQuery" class="search-empty">
        <div class="empty-compass-box">
          <Search :size="28" class="empty-compass-icon animate-pulse" />
        </div>
        <p>未找到匹配的会话</p>
        <button type="button" class="btn-clear-search" @click="searchQuery = ''">
          清空搜索词
        </button>
      </div>
      <p v-else class="empty">暂无会话</p>
    </template>

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
  padding: 10px 12px;
  min-height: 72px;
  transition: all var(--duration-fast) var(--ease-out);
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
}

/* 会话头像列 */
.item-avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.item-avatar {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  object-fit: cover;
  display: block;
  box-shadow: var(--shadow-sm);
  user-select: none;
}

.item-avatar--initial {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  font-weight: 700;
}

.group-badge {
  position: absolute;
  right: -4px;
  bottom: -4px;
  width: 16px;
  height: 16px;
  border-radius: var(--radius-full);
  background: var(--c-primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #fff;
}

.item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
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
  margin-bottom: 0;
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

/* Sidebar Search Box Styles */
.search-box {
  padding: 8px 12px;
  background: var(--c-bg-panel);
  border-bottom: 1px solid var(--c-border);
}

.search-inner {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.02);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  padding: 7px 10px;
  position: relative;
  transition: all var(--duration-fast) var(--ease-out);
}

.search-inner:focus-within {
  background: #fff;
  border-color: var(--c-primary);
  box-shadow: 0 0 0 2px rgba(0, 198, 112, 0.1);
}

.search-icon {
  color: var(--c-text-muted);
  flex-shrink: 0;
  transition: color var(--duration-fast) var(--ease-out);
}

.search-inner:focus-within .search-icon {
  color: var(--c-primary);
}

.search-input {
  border: none;
  background: transparent;
  outline: none;
  font-size: 12px;
  color: var(--c-text-main);
  flex: 1;
  padding: 0;
}

.search-input::placeholder {
  color: var(--c-text-muted);
  opacity: 0.8;
}

.search-clear-btn {
  border: none;
  background: transparent;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--c-text-muted);
  border-radius: var(--radius-full);
  transition: all var(--duration-fast) var(--ease-out);
}

.search-clear-btn:hover {
  background: var(--c-bg-hover);
  color: var(--c-text-main);
}

/* Search Empty States */
.search-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 16px;
  text-align: center;
}

.empty-compass-box {
  width: 50px;
  height: 50px;
  border-radius: var(--radius-full);
  background: var(--c-primary-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  box-shadow: inset 0 2px 4px rgba(0, 198, 112, 0.05);
}

.empty-compass-icon {
  color: var(--c-primary);
}

.search-empty p {
  font-size: 13px;
  color: var(--c-text-muted);
  margin: 0 0 16px 0;
}

.btn-clear-search {
  border: 1px solid var(--c-primary-soft);
  background: var(--c-primary-soft);
  color: var(--c-primary-active);
  font-size: 12px;
  font-weight: 600;
  padding: 6px 16px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.btn-clear-search:hover {
  background: var(--c-primary);
  border-color: var(--c-primary);
  color: #fff;
  box-shadow: 0 4px 12px rgba(0, 198, 112, 0.2);
}
</style>
