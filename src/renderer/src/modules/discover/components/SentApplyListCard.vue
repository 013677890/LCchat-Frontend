<script setup lang="ts">
interface SentApplyItem {
  applyId: number
  targetUuid: string
  targetNickname: string
  reason: string
  status: number
  createdAt: number
}

const props = defineProps<{
  items: SentApplyItem[]
  retryingApplyId?: number
  message?: string
  errorMessage?: string
}>()

const emit = defineEmits<{
  retry: [number]
}>()

function getStatusText(status: number): string {
  if (status === 0) {
    return '待处理'
  }
  if (status === 1) {
    return '已同意'
  }
  if (status === 2) {
    return '已拒绝'
  }
  return `未知(${status})`
}

function canRetry(status: number): boolean {
  return status === 2
}

function formatDateTime(timestamp: number): string {
  if (!timestamp) {
    return '-'
  }
  return new Date(timestamp).toLocaleString('zh-CN')
}

function handleRetry(applyId: number): void {
  emit('retry', applyId)
}
</script>

<template>
  <section class="sent-card">
    <header class="sent-header">
      <h3>已发送申请</h3>
      <p>展示你发出的好友申请，可对已拒绝申请发起重发。</p>
    </header>

    <ul v-if="props.items.length > 0" class="sent-list">
      <li v-for="item in props.items" :key="item.applyId" class="sent-item">
        <div class="sent-meta">
          <strong>{{ item.targetNickname || item.targetUuid }}</strong>
          <p>申请ID：{{ item.applyId }} · {{ formatDateTime(item.createdAt) }}</p>
          <small>状态：{{ getStatusText(item.status) }} · 附言：{{ item.reason || '-' }}</small>
        </div>
        <button
          type="button"
          class="action-btn action-btn--ghost"
          :disabled="!canRetry(item.status) || props.retryingApplyId === item.applyId"
          @click="handleRetry(item.applyId)"
        >
          <template v-if="props.retryingApplyId === item.applyId">重发中...</template>
          <template v-else>重发申请</template>
        </button>
      </li>
    </ul>
    <p v-else class="empty">暂无已发送申请</p>

    <p v-if="props.message" class="message">{{ props.message }}</p>
    <p v-if="props.errorMessage" class="error">{{ props.errorMessage }}</p>
  </section>
</template>

<style scoped>
.sent-card {
  margin-top: 12px;
  border: 1px solid var(--c-border);
  border-radius: 12px;
  background: #fff;
  padding: 12px;
  box-shadow: var(--shadow-1);
}

.sent-header h3 {
  margin: 0;
  font-size: 14px;
  color: var(--c-text-main);
}

.sent-header p {
  margin: 6px 0 0;
  color: var(--c-text-muted);
  font-size: 12px;
}

.sent-list {
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}

.sent-item {
  border: 1px solid var(--c-border);
  border-radius: 10px;
  background: #fafbfc;
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.sent-meta strong {
  display: block;
  color: var(--c-text-main);
  font-size: 13px;
}

.sent-meta p {
  margin: 4px 0 0;
  color: var(--c-text-sub);
  font-size: 12px;
}

.sent-meta small {
  display: block;
  margin-top: 2px;
  color: var(--c-text-muted);
  font-size: 11px;
}

.action-btn {
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 7px 14px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease-out;
}

.action-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.action-btn--ghost {
  color: var(--c-text-sub);
  background: #fff;
  border-color: var(--c-border);
}

.action-btn--ghost:hover:not(:disabled) {
  border-color: #c7ced7;
}

.empty {
  margin: 10px 0 0;
  color: var(--c-text-muted);
  font-size: 12px;
}

.message {
  margin: 8px 0 0;
  color: var(--c-primary);
  font-size: 12px;
}

.error {
  margin: 8px 0 0;
  color: var(--c-danger);
  font-size: 12px;
}
</style>
