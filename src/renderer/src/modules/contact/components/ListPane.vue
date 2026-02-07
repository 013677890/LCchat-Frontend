<script setup lang="ts">
interface ListPaneItem {
  id: string
  title: string
  subtitle: string
  meta?: string
  badge?: number
  online?: boolean
}

const props = defineProps<{
  title: string
  hint?: string
  items: ListPaneItem[]
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
</script>

<template>
  <section class="pane">
    <header class="header">
      <h1>{{ props.title }}</h1>
      <span class="hint">{{ props.hint || `${props.items.length} 条` }}</span>
    </header>

    <p v-if="props.loading" class="empty">加载中...</p>
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
  width: 320px;
  min-width: 320px;
  border-right: 1px solid var(--c-border);
  background: var(--c-bg-panel);
  display: flex;
  flex-direction: column;
}

.header {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--c-border);
}

.header h1 {
  font-size: 18px;
  margin: 0;
}

.hint {
  font-size: 12px;
  color: var(--c-text-muted);
}

.list {
  list-style: none;
  margin: 0;
  padding: 8px 0;
  overflow-y: auto;
}

.item {
  width: 100%;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(229, 231, 235, 0.5);
  transition: background-color 0.12s ease-out;
}

.item:hover {
  background: #f8fafc;
}

.item--active {
  background: #eefaf2;
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
  min-width: 18px;
  height: 18px;
  border-radius: 999px;
  padding: 0 6px;
  display: inline-grid;
  place-items: center;
  font-size: 11px;
  color: #fff;
  background: var(--c-primary);
}

.empty {
  margin: 0;
  padding: 20px 16px;
  color: var(--c-text-muted);
  font-size: 13px;
}
</style>
