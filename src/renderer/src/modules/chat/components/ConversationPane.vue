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
      <div>
        <h1>会话</h1>
        <p class="header-desc">最近消息与未读提醒</p>
      </div>
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
  width: 286px;
  min-width: 286px;
  border-right: 1px solid var(--c-border);
  background: #f7f8fa;
  display: flex;
  flex-direction: column;
}

.header {
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--c-border);
  background: #fff;
}

.header h1 {
  font-size: 16px;
  margin: 0;
  color: var(--c-text-main);
}

.header-desc {
  margin: 2px 0 0;
  color: var(--c-text-muted);
  font-size: 11px;
}

.hint {
  font-size: 10px;
  color: var(--c-text-muted);
  border: 1px solid #e4e8ed;
  border-radius: 999px;
  padding: 2px 7px;
  background: #fff;
}

.list {
  list-style: none;
  margin: 0;
  padding: 6px 0;
  overflow-y: auto;
}

.item {
  width: 100%;
  border: none;
  border-left: 3px solid transparent;
  border-radius: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
  padding: 9px 12px;
  min-height: 70px;
  transition: background-color 0.2s ease-out;
}

.item:hover {
  background: #f0f2f5;
}

.item--active {
  border-left-color: var(--c-primary);
  background: #eaf7ef;
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
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
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
  color: #8d96a3;
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
  background: #f53f3f;
}

.empty {
  margin: 0;
  padding: 20px 12px;
  color: var(--c-text-muted);
  font-size: 12px;
}
</style>
