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
  width: 72px;
  min-width: 72px;
  background: var(--c-bg-sidebar);
  border-right: 1px solid var(--c-border);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 14px 8px;
  gap: 14px;
}

.brand {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #1ecf78 0%, #089a55 100%);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.3px;
  box-shadow: 0 6px 16px rgba(7, 193, 96, 0.35);
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: auto;
}

.nav-item {
  position: relative;
  width: 42px;
  height: 42px;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 12px;
  padding: 0;
  cursor: pointer;
  color: var(--c-text-on-dark-muted);
  display: grid;
  place-items: center;
  font-size: 12px;
  line-height: 1.2;
  transition: all 0.2s ease;
}

.nav-item:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.nav-item--active {
  color: #fff;
  background: rgba(7, 193, 96, 0.24);
  border-color: rgba(7, 193, 96, 0.5);
  box-shadow: inset 3px 0 0 #07c160;
}

.nav-icon {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.2px;
}

.nav-badge {
  position: absolute;
  top: -3px;
  right: -3px;
  min-width: 16px;
  height: 16px;
  border-radius: 999px;
  padding: 0 4px;
  display: inline-grid;
  place-items: center;
  background: var(--c-danger);
  color: #fff;
  font-size: 10px;
  line-height: 1;
  font-weight: 600;
}

.sidebar-footer {
  margin-top: auto;
  display: grid;
  gap: 8px;
}

.profile-btn,
.logout {
  width: 38px;
  height: 38px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--c-text-on-dark);
  font-size: 12px;
  cursor: pointer;
  font-weight: 600;
  display: grid;
  place-items: center;
}

.profile-btn {
  background: rgba(7, 193, 96, 0.22);
  border-color: rgba(7, 193, 96, 0.4);
}

.logout:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.22);
}
</style>
