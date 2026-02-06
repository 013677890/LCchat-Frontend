<script setup lang="ts">
interface ConversationListItem {
  convId: string
  title: string
  preview: string
  unread: number
  timeText: string
}

const props = defineProps<{
  items: ConversationListItem[]
  activeConvId: string
  loading: boolean
}>()

const emit = defineEmits<{
  select: [string]
}>()

function handleSelect(convId: string): void {
  emit('select', convId)
}
</script>

<template>
  <section class="conversations">
    <header class="header">
      <h1>会话</h1>
      <span class="hint">{{ props.items.length }} 条</span>
    </header>

    <p v-if="props.loading" class="empty">正在加载本地缓存...</p>
    <ul v-else-if="props.items.length > 0" class="list">
      <li v-for="item in props.items" :key="item.convId">
        <button
          class="item"
          :class="{ 'item--active': props.activeConvId === item.convId }"
          type="button"
          @click="handleSelect(item.convId)"
        >
          <div class="item-head">
            <strong>{{ item.title }}</strong>
            <span>{{ item.timeText }}</span>
          </div>
          <div class="item-body">
            <p>{{ item.preview || '暂无消息' }}</p>
            <small v-if="item.unread > 0">{{ item.unread }}</small>
          </div>
        </button>
      </li>
    </ul>
    <p v-else class="empty">暂无会话</p>
  </section>
</template>

<style scoped>
.conversations {
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
