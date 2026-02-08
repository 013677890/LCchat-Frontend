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
  color: var(--c-text-main);
}

.header-desc {
  margin: 4px 0 0;
  color: var(--c-text-muted);
  font-size: 11px;
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
  padding: 10px 10px 12px;
  overflow-y: auto;
  display: grid;
  gap: 8px;
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
