<script setup lang="ts">
import { computed } from 'vue'
import type { MainNavKey } from '../../../stores/app.store'

const props = defineProps<{
  activeNav: MainNavKey
  userLabel: string
  discoverBadge?: number
}>()

const emit = defineEmits<{
  select: [MainNavKey]
  logout: []
}>()

const navItems: Array<{ key: MainNavKey; label: string; icon: string }> = [
  { key: 'chat', label: '消息', icon: 'M' },
  { key: 'contacts', label: '通讯录', icon: 'C' },
  { key: 'discover', label: '发现', icon: 'D' },
  { key: 'settings', label: '设置', icon: 'S' }
]

function handleSelect(nav: MainNavKey): void {
  emit('select', nav)
}

const userInitial = computed(() => {
  const normalized = props.userLabel.trim()
  if (!normalized) {
    return 'U'
  }
  return normalized.slice(0, 1).toUpperCase()
})
</script>

<template>
  <aside class="sidebar">
    <header class="brand" title="LCchat">LC</header>

    <nav class="nav">
      <button
        v-for="item in navItems"
        :key="item.key"
        class="nav-item"
        :class="{ 'nav-item--active': props.activeNav === item.key }"
        type="button"
        :title="item.label"
        @click="handleSelect(item.key)"
      >
        <span class="nav-icon">{{ item.icon }}</span>
        <small v-if="item.key === 'discover' && (props.discoverBadge || 0) > 0" class="nav-badge">
          {{ Math.min(props.discoverBadge || 0, 99) }}
        </small>
      </button>
    </nav>

    <footer class="sidebar-footer">
      <button class="profile-btn" type="button" :title="props.userLabel">
        {{ userInitial }}
      </button>
      <button class="logout" type="button" title="退出登录" @click="emit('logout')">⎋</button>
    </footer>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 76px;
  min-width: 76px;
  background: var(--c-bg-sidebar);
  backdrop-filter: var(--blur-lg);
  -webkit-backdrop-filter: var(--blur-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 8px;
  gap: 16px;
  box-shadow: 1px 0 12px rgba(0, 0, 0, 0.08);
  border-right: 1px solid rgba(255, 255, 255, 0.05); /* 利用透明白边强调质感 */
  z-index: 10;
}

.brand {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #00E583 0%, #00B164 100%);
  color: #fff;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.5px;
  box-shadow: 0 4px 12px rgba(0, 198, 112, 0.4);
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  align-items: center;
}

.nav-item {
  position: relative;
  width: 48px;
  height: 48px;
  border: none;
  background: transparent;
  border-radius: var(--radius-md);
  padding: 0;
  cursor: pointer;
  color: var(--c-text-on-dark-muted);
  display: grid;
  place-items: center;
  transition: all var(--duration-fast) var(--ease-out);
}

.nav-item:hover {
  color: #fff;
  background: var(--c-bg-sidebar-active);
  transform: translateY(-2px);
}

.nav-item--active {
  color: var(--c-primary);
  background: rgba(0, 198, 112, 0.15);
  box-shadow: inset 4px 0 0 var(--c-primary);
  /* 使用伪元素制作更柔和的选中高亮 */
}

.nav-item--active::before {
  content: '';
  position: absolute;
  left: -8px;
  height: 24px;
  width: 4px;
  border-radius: 0 4px 4px 0;
  background: var(--c-primary);
  opacity: 0; /* 根据需要也可以用这种方式代替 box-shadow */
}

.nav-icon {
  font-size: 16px;
  font-weight: 700;
}

.nav-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 18px;
  height: 18px;
  border-radius: var(--radius-full);
  padding: 0 5px;
  display: inline-grid;
  place-items: center;
  background: var(--c-danger);
  color: #fff;
  font-size: 11px;
  font-weight: bold;
  box-shadow: var(--shadow-sm);
  border: 2px solid var(--c-bg-sidebar); /* 加上边框，避免与背景融为一体 */
}

.sidebar-footer {
  margin-top: auto;
  display: grid;
  gap: 12px;
  width: 100%;
  place-items: center;
}

.profile-btn,
.logout {
  width: 44px;
  height: 44px;
  border: 1px solid var(--c-border-light);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.05);
  color: var(--c-text-on-dark);
  font-size: 14px;
  cursor: pointer;
  font-weight: bold;
  display: grid;
  place-items: center;
  transition: all var(--duration-fast) var(--ease-out);
}

.profile-btn {
  background: var(--c-primary-soft);
  border-color: rgba(0, 198, 112, 0.3);
  color: var(--c-primary);
}

.profile-btn:hover {
  background: rgba(0, 198, 112, 0.25);
  transform: translateY(-2px);
}

.logout:hover {
  color: #fff;
  background: var(--c-bg-sidebar-active);
  border-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}
</style>
