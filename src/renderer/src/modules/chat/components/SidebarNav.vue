<script setup lang="ts">
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
  { key: 'chat', label: '消息', icon: '聊' },
  { key: 'contacts', label: '通讯录', icon: '友' },
  { key: 'discover', label: '发现', icon: '探' },
  { key: 'settings', label: '设置', icon: '设' }
]

function handleSelect(nav: MainNavKey): void {
  emit('select', nav)
}
</script>

<template>
  <aside class="sidebar">
    <header class="brand">
      <div class="brand-icon">LC</div>
      <div class="brand-text">
        <div class="brand-title">LCchat</div>
        <div class="brand-user">{{ props.userLabel }}</div>
      </div>
    </header>

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
        <span>{{ item.label }}</span>
        <small v-if="item.key === 'discover' && (props.discoverBadge || 0) > 0" class="nav-badge">
          {{ Math.min(props.discoverBadge || 0, 99) }}
        </small>
      </button>
    </nav>

    <button class="logout" type="button" @click="emit('logout')">退出登录</button>
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
  padding: 12px 8px;
  gap: 12px;
}

.brand {
  width: 100%;
  display: grid;
  place-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.brand-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: var(--c-primary);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
}

.brand-text {
  text-align: center;
}

.brand-title {
  font-size: 11px;
  color: var(--c-text-main);
  font-weight: 600;
}

.brand-user {
  font-size: 10px;
  color: var(--c-text-muted);
  max-width: 64px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.nav-item {
  position: relative;
  border: none;
  background: transparent;
  border-radius: 10px;
  padding: 8px 4px;
  cursor: pointer;
  color: var(--c-text-sub);
  display: grid;
  place-items: center;
  gap: 4px;
  font-size: 10px;
  line-height: 1;
  transition: background-color 0.15s ease-out;
}

.nav-item:hover {
  background: rgba(7, 193, 96, 0.08);
}

.nav-item--active {
  color: var(--c-primary);
  background: rgba(7, 193, 96, 0.12);
}

.nav-icon {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: #fff;
  box-shadow: var(--shadow-1);
  font-size: 12px;
}

.nav-badge {
  position: absolute;
  top: 4px;
  right: 6px;
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

.logout {
  margin-top: auto;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--c-text-muted);
  font-size: 11px;
  cursor: pointer;
  padding: 6px 4px;
}

.logout:hover {
  color: var(--c-danger);
}
</style>
