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
    <header class="brand-card">
      <div class="brand-top">
        <div class="brand-icon">LC</div>
        <div class="brand-title">LCchat</div>
      </div>
      <p class="brand-user" :title="props.userLabel">{{ props.userLabel }}</p>
      <small class="brand-state">桌面在线</small>
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
        <span class="nav-label">{{ item.label }}</span>
        <small v-if="item.key === 'discover' && (props.discoverBadge || 0) > 0" class="nav-badge">
          {{ Math.min(props.discoverBadge || 0, 99) }}
        </small>
      </button>
    </nav>

    <button class="logout" type="button" @click="emit('logout')">退出</button>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 108px;
  min-width: 108px;
  background:
    linear-gradient(180deg, #f7fbf8 0%, #eff6f2 100%);
  border-right: 1px solid var(--c-border);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 12px 10px;
  gap: 12px;
}

.brand-card {
  border: 1px solid var(--c-border);
  border-radius: 14px;
  background: #fff;
  padding: 10px 8px;
  display: grid;
  gap: 6px;
  box-shadow: var(--shadow-1);
}

.brand-top {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.brand-icon {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #1ecf78 0%, #089a55 100%);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.3px;
}

.brand-title {
  margin: 0;
  font-size: 12px;
  color: var(--c-text-main);
  font-weight: 700;
}

.brand-user {
  margin: 0;
  text-align: center;
  font-size: 10px;
  color: var(--c-text-sub);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brand-state {
  text-align: center;
  color: var(--c-primary);
  font-size: 10px;
  background: var(--c-primary-soft);
  border-radius: 999px;
  padding: 3px 0;
  font-weight: 600;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.nav-item {
  position: relative;
  border: none;
  background: #fff;
  border: 1px solid var(--c-border);
  border-radius: 11px;
  padding: 8px 6px;
  cursor: pointer;
  color: var(--c-text-sub);
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 7px;
  font-size: 11px;
  line-height: 1.2;
  transition:
    background-color 0.15s ease-out,
    border-color 0.15s ease-out;
  box-shadow: var(--shadow-1);
}

.nav-item:hover {
  border-color: #b9d3c2;
  background: #f7fdfa;
}

.nav-item--active {
  color: var(--c-primary);
  background: rgba(8, 182, 98, 0.12);
  border-color: rgba(8, 182, 98, 0.32);
}

.nav-icon {
  width: 24px;
  height: 24px;
  border-radius: 7px;
  display: grid;
  place-items: center;
  background: #eff4f1;
  font-size: 11px;
  font-weight: 700;
}

.nav-item--active .nav-icon {
  background: #dcf4e7;
}

.nav-label {
  font-size: 11px;
  font-weight: 600;
}

.nav-badge {
  position: absolute;
  top: -4px;
  right: -4px;
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
  border: 1px solid var(--c-border);
  border-radius: 10px;
  background: #fff;
  color: var(--c-text-sub);
  font-size: 12px;
  cursor: pointer;
  padding: 8px 4px;
  font-weight: 600;
  box-shadow: var(--shadow-1);
}

.logout:hover {
  color: var(--c-danger);
  border-color: rgba(245, 63, 63, 0.4);
  background: rgba(245, 63, 63, 0.06);
}
</style>
