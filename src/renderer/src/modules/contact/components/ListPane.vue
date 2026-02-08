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
  width: 340px;
  min-width: 340px;
  border-right: 1px solid var(--c-border);
  background: linear-gradient(180deg, #f7fbf8 0%, #f0f7f3 100%);
  display: flex;
  flex-direction: column;
}

.header {
  min-height: 76px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 12px;
  border-bottom: 1px solid var(--c-border);
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(4px);
}

.header h1 {
  font-size: 18px;
  margin: 0;
}

.hint {
  font-size: 11px;
  color: var(--c-text-sub);
  border: 1px solid var(--c-border);
  border-radius: 999px;
  padding: 3px 8px;
  background: #fff;
}

.list {
  list-style: none;
  margin: 0;
  padding: 8px 10px 12px;
  overflow-y: auto;
  display: grid;
  gap: 8px;
}

.group-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 10px 12px;
  display: grid;
  gap: 8px;
}

.group-block + .group-block {
  margin-top: 6px;
}

.group-list .list {
  padding: 0;
  overflow: visible;
}

.group-header {
  height: 28px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--c-text-muted);
  border: 1px solid var(--c-border);
  border-radius: 10px;
  background: #fff;
}

.group-header strong {
  font-size: 12px;
  font-weight: 600;
}

.group-header span {
  font-size: 11px;
}

.item {
  width: 100%;
  border: 1px solid var(--c-border);
  border-radius: 12px;
  background: #fff;
  text-align: left;
  cursor: pointer;
  padding: 10px 11px;
  transition: background-color 0.12s ease-out;
  box-shadow: var(--shadow-1);
}

.item:hover {
  border-color: #bfd4c7;
  background: #fafffd;
}

.item--active {
  border-color: rgba(8, 182, 98, 0.34);
  background: #ebf9f1;
}

.item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  gap: 8px;
}

.item-head strong {
  color: var(--c-text-main);
  font-size: 14px;
  line-height: 1.4;
}

.item-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.presence-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.presence-dot--online {
  background: var(--c-success);
  box-shadow: 0 0 0 2px rgba(0, 180, 42, 0.16);
}

.presence-dot--offline {
  background: #c3c9d2;
}

.item-head span {
  color: var(--c-text-muted);
  font-size: 11px;
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

.item-body small {
  min-width: 18px;
  height: 18px;
  border-radius: 999px;
  padding: 0 6px;
  display: inline-grid;
  place-items: center;
  font-size: 11px;
  color: #fff;
  background: linear-gradient(180deg, #1ac36f 0%, #089a55 100%);
}

.empty {
  margin: 0;
  padding: 20px 16px;
  color: var(--c-text-muted);
  font-size: 13px;
}
</style>
