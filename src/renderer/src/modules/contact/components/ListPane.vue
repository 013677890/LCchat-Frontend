<script setup lang="ts">
import { computed } from 'vue'

interface ListPaneItem {
  id: string
  title: string
  subtitle: string
  meta?: string
  badge?: number
  online?: boolean
}

interface ListPaneGroup {
  key: string
  label: string
  hint?: string
  items: ListPaneItem[]
}

const props = defineProps<{
  title: string
  hint?: string
  items: ListPaneItem[]
  groups?: ListPaneGroup[]
  selectedId: string
  emptyText: string
  loading?: boolean
}>()

const emit = defineEmits<{
  select: [string]
}>()

function handleSelect(id: string): void {
  emit('select', id)
}

const totalCount = computed(() => {
  if (!props.groups || props.groups.length === 0) {
    return props.items.length
  }

  return props.groups.reduce((sum, group) => sum + group.items.length, 0)
})
</script>

<template>
  <section class="pane">
    <header class="header">
      <h1>{{ props.title }}</h1>
      <span class="hint">{{ props.hint || `${totalCount} 条` }}</span>
    </header>

    <p v-if="props.loading" class="empty">加载中...</p>
    <div v-else-if="(props.groups || []).length > 0 && totalCount > 0" class="group-list">
      <section v-for="group in props.groups" :key="group.key" class="group-block">
        <header class="group-header">
          <strong>{{ group.label }}</strong>
          <span>{{ group.hint || `${group.items.length} 人` }}</span>
        </header>
        <ul class="list">
          <li v-for="item in group.items" :key="item.id">
            <button
              class="item"
              :class="{ 'item--active': item.id === props.selectedId }"
              type="button"
              @click="handleSelect(item.id)"
            >
              <div class="item-head">
                <div class="item-title">
                  <span
                    v-if="typeof item.online === 'boolean'"
                    class="presence-dot"
                    :class="item.online ? 'presence-dot--online' : 'presence-dot--offline'"
                  />
                  <strong>{{ item.title }}</strong>
                </div>
                <span v-if="item.meta">{{ item.meta }}</span>
              </div>
              <div class="item-body">
                <p>{{ item.subtitle || '-' }}</p>
                <small v-if="(item.badge || 0) > 0">{{ item.badge }}</small>
              </div>
            </button>
          </li>
        </ul>
      </section>
    </div>
    <ul v-else-if="props.items.length > 0" class="list">
      <li v-for="item in props.items" :key="item.id">
        <button
          class="item"
          :class="{ 'item--active': item.id === props.selectedId }"
          type="button"
          @click="handleSelect(item.id)"
        >
          <div class="item-head">
            <div class="item-title">
              <span
                v-if="typeof item.online === 'boolean'"
                class="presence-dot"
                :class="item.online ? 'presence-dot--online' : 'presence-dot--offline'"
              />
              <strong>{{ item.title }}</strong>
            </div>
            <span v-if="item.meta">{{ item.meta }}</span>
          </div>
          <div class="item-body">
            <p>{{ item.subtitle || '-' }}</p>
            <small v-if="(item.badge || 0) > 0">{{ item.badge }}</small>
          </div>
        </button>
      </li>
    </ul>
    <p v-else class="empty">{{ props.emptyText }}</p>
  </section>
</template>

<style scoped>
.pane {
  width: 300px;
  min-width: 300px;
  border-right: 1px solid var(--c-border);
  background: var(--c-bg-panel-solid);
  display: flex;
  flex-direction: column;
  z-index: 5;
}

.header {
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--c-bg-panel-solid);
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}

.header h1 {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  color: var(--c-text-main);
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
  gap: 4px;
}

.group-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.group-block + .group-block {
  margin-top: 0;
}

.group-list .list {
  padding: 0;
  overflow: visible;
}

.group-header {
  height: 32px;
  padding: 0 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--c-text-muted);
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  margin-bottom: 8px;
}

.group-header strong {
  font-size: 12px;
  font-weight: 700;
  color: var(--c-text-sub);
}

.group-header span {
  font-size: 11px;
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
  background: var(--c-bg-hover);
  transform: translateY(-1px);
}

.item--active {
  background: var(--c-primary-soft);
  border-color: rgba(0, 198, 112, 0.1);
  box-shadow: 0 4px 12px rgba(0, 198, 112, 0.08);
}

.item--active:hover {
  background: rgba(0, 198, 112, 0.16);
  transform: none;
}

.item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  gap: 8px;
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

.item--active .item-head strong {
  color: var(--c-primary-active);
}

.item-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.presence-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

.presence-dot--online {
  background: var(--c-success);
  box-shadow: 0 0 0 3px rgba(82, 196, 26, 0.2);
}

.presence-dot--offline {
  background: #c3c9d2;
}

.item-head span {
  color: var(--c-text-muted);
  font-size: 12px;
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
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.item-body small {
  min-width: 20px;
  height: 20px;
  border-radius: var(--radius-full);
  padding: 0 6px;
  display: inline-grid;
  place-items: center;
  font-size: 12px;
  font-weight: bold;
  color: #fff;
  background: var(--c-danger);
  box-shadow: 0 2px 6px rgba(255, 77, 79, 0.3);
}

.empty {
  margin: 0;
  padding: 32px 16px;
  text-align: center;
  color: var(--c-text-muted);
  font-size: 13px;
}
</style>
