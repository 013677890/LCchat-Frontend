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
  margin: 0;
  font-weight: 700;
  color: var(--c-text-main);
}

.header-desc {
  margin: 4px 0 0;
  color: var(--c-text-muted);
  font-size: 12px;
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
  box-shadow: 0 4px 12px rgba(0, 198, 112, 0.08); /* 给激活的会话卡片一点浮雕感 */
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

.item-head span {
  color: var(--c-text-muted);
  font-size: 12px;
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
