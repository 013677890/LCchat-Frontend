<script setup lang="ts">
interface SearchResultItem {
  uuid: string
  nickname: string
  signature: string
  isFriend: boolean
}

const props = defineProps<{
  keyword: string
  reason: string
  results: SearchResultItem[]
  searching?: boolean
  sendingTargetUuid?: string
  existingFriendIds?: string[]
  blacklistIds?: string[]
  message?: string
  errorMessage?: string
}>()

const emit = defineEmits<{
  'update:keyword': [string]
  'update:reason': [string]
  search: []
  'send-apply': [string]
  'clear-feedback': []
}>()

function isExistingFriend(peerUuid: string): boolean {
  return (props.existingFriendIds ?? []).includes(peerUuid)
}

function isPeerInBlacklist(peerUuid: string): boolean {
  return (props.blacklistIds ?? []).includes(peerUuid)
}

function handleKeywordInput(event: Event): void {
  emit('clear-feedback')
  const value = (event.target as HTMLInputElement).value
  emit('update:keyword', value)
}

function handleReasonInput(event: Event): void {
  emit('clear-feedback')
  const value = (event.target as HTMLInputElement).value
  emit('update:reason', value)
}

function handleSearch(): void {
  emit('search')
}

function handleSendApply(targetUuid: string): void {
  emit('send-apply', targetUuid)
}
</script>

<template>
  <section class="search-user-card">
    <header class="search-user-header">
      <h3>搜索用户</h3>
      <p>输入关键词搜索并发送好友申请。</p>
    </header>

    <div class="search-user-form">
      <input
        :value="props.keyword"
        placeholder="昵称 / UUID / 邮箱关键词"
        maxlength="20"
        @input="handleKeywordInput"
      />
      <button
        type="button"
        class="action-btn action-btn--primary"
        :disabled="Boolean(props.searching) || !props.keyword.trim()"
        @click="handleSearch"
      >
        {{ props.searching ? '搜索中...' : '搜索' }}
      </button>
    </div>

    <label class="search-reason-field">
      <span>申请附言</span>
      <input
        :value="props.reason"
        maxlength="100"
        placeholder="例如：一起交流技术"
        @input="handleReasonInput"
      />
    </label>

    <ul v-if="props.results.length > 0" class="search-result-list">
      <li v-for="item in props.results" :key="item.uuid" class="search-result-item">
        <div class="search-result-meta">
          <strong>{{ item.nickname || item.uuid }}</strong>
          <p>{{ item.signature || item.uuid }}</p>
        </div>
        <button
          type="button"
          class="action-btn action-btn--ghost"
          :disabled="
            props.sendingTargetUuid === item.uuid ||
            item.isFriend ||
            isExistingFriend(item.uuid) ||
            isPeerInBlacklist(item.uuid)
          "
          @click="handleSendApply(item.uuid)"
        >
          <template v-if="props.sendingTargetUuid === item.uuid">发送中...</template>
          <template v-else-if="item.isFriend || isExistingFriend(item.uuid)">已是好友</template>
          <template v-else-if="isPeerInBlacklist(item.uuid)">黑名单中</template>
          <template v-else>加好友</template>
        </button>
      </li>
    </ul>
    <p v-else class="empty">暂无搜索结果</p>

    <p v-if="props.message" class="message">{{ props.message }}</p>
    <p v-if="props.errorMessage" class="error">{{ props.errorMessage }}</p>
  </section>
</template>

<style scoped>
.search-user-card {
  border: 1px solid var(--c-border);
  border-radius: 12px;
  background: #fff;
  padding: 12px;
  box-shadow: var(--shadow-1);
}

.search-user-header h3 {
  margin: 0;
  font-size: 14px;
  color: var(--c-text-main);
}

.search-user-header p {
  margin: 6px 0 0;
  color: var(--c-text-muted);
  font-size: 12px;
}

.search-user-form {
  margin-top: 10px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
}

.search-user-form input,
.search-reason-field input {
  width: 100%;
  border: 1px solid var(--c-border);
  border-radius: 8px;
  padding: 7px 10px;
  font-size: 13px;
  color: var(--c-text-main);
  outline: none;
}

.search-user-form input:focus,
.search-reason-field input:focus {
  border-color: var(--c-primary);
}

.search-reason-field {
  margin-top: 8px;
  display: grid;
  gap: 6px;
}

.search-reason-field span {
  font-size: 12px;
  color: var(--c-text-sub);
}

.search-result-list {
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}

.search-result-item {
  border: 1px solid var(--c-border);
  border-radius: 10px;
  background: #fafbfc;
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.search-result-meta strong {
  display: block;
  color: var(--c-text-main);
  font-size: 13px;
}

.search-result-meta p {
  margin: 4px 0 0;
  color: var(--c-text-sub);
  font-size: 12px;
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

.action-btn--primary {
  color: #fff;
  background: var(--c-primary);
}

.action-btn--primary:hover:not(:disabled) {
  background: var(--c-primary-hover);
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
