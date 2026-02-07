<script setup lang="ts">
import { computed } from 'vue'

interface DiscoverProfileItem {
  uuid: string
  nickname: string
  avatar: string
  signature: string
  isFriend: boolean
  isOnline: boolean | null
  lastSeenAt: string
  presenceText: string
}

const props = defineProps<{
  profile: DiscoverProfileItem | null
  loading?: boolean
  sending?: boolean
  relationBlocked?: boolean
  reasonPreview?: string
  existingFriendIds?: string[]
  blacklistIds?: string[]
  message?: string
  errorMessage?: string
}>()

const emit = defineEmits<{
  'send-apply': [targetUuid: string]
  'clear-feedback': []
  close: []
}>()

const isExistingFriend = computed(() => {
  const profile = props.profile
  if (!profile) {
    return false
  }
  return profile.isFriend || (props.existingFriendIds ?? []).includes(profile.uuid)
})

const isInBlacklist = computed(() => {
  const profile = props.profile
  if (!profile) {
    return false
  }
  return Boolean(props.relationBlocked) || (props.blacklistIds ?? []).includes(profile.uuid)
})

const canSendApply = computed(() => {
  return Boolean(props.profile) && !props.sending && !isExistingFriend.value && !isInBlacklist.value
})

const sendButtonText = computed(() => {
  if (props.sending) {
    return '发送中...'
  }
  if (isExistingFriend.value) {
    return '已是好友'
  }
  if (isInBlacklist.value) {
    return '黑名单中'
  }
  return '一键发送申请'
})

const reasonText = computed(() => props.reasonPreview?.trim() || '我是 LCchat 用户')

function handleSendApply(): void {
  if (!props.profile || !canSendApply.value) {
    return
  }

  emit('clear-feedback')
  emit('send-apply', props.profile.uuid)
}

function handleClose(): void {
  emit('close')
}
</script>

<template>
  <section class="scan-card">
    <header class="scan-header">
      <h3>扫码结果</h3>
      <button type="button" class="action-btn action-btn--ghost" @click="handleClose">关闭</button>
    </header>

    <p class="hint">二维码解析后会直接展示目标用户，可直接发起好友申请。</p>

    <div v-if="props.loading" class="loading">正在加载用户详情...</div>
    <div v-else-if="props.profile" class="profile-wrap">
      <div class="avatar-wrap">
        <img v-if="props.profile.avatar" :src="props.profile.avatar" alt="avatar" />
        <span v-else>{{
          (props.profile.nickname || props.profile.uuid).slice(0, 1).toUpperCase()
        }}</span>
      </div>

      <div class="profile-main">
        <h4>{{ props.profile.nickname || props.profile.uuid }}</h4>
        <p class="uuid">{{ props.profile.uuid }}</p>
        <p class="signature">{{ props.profile.signature || '暂无签名' }}</p>
        <small class="presence">{{ props.profile.presenceText }}</small>
      </div>

      <div class="profile-actions">
        <p class="reason">附言：{{ reasonText }}</p>
        <button
          type="button"
          class="action-btn action-btn--primary"
          :disabled="!canSendApply"
          @click="handleSendApply"
        >
          {{ sendButtonText }}
        </button>
      </div>
    </div>
    <p v-else class="empty">暂无扫码用户详情</p>

    <p v-if="props.message" class="message">{{ props.message }}</p>
    <p v-if="props.errorMessage" class="error">{{ props.errorMessage }}</p>
  </section>
</template>

<style scoped>
.scan-card {
  margin-top: 12px;
  border: 1px solid var(--c-border);
  border-radius: 12px;
  background: #fff;
  padding: 12px;
  box-shadow: var(--shadow-1);
}

.scan-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.scan-header h3 {
  margin: 0;
  font-size: 14px;
  color: var(--c-text-main);
}

.hint {
  margin: 6px 0 0;
  color: var(--c-text-muted);
  font-size: 12px;
}

.loading,
.empty {
  margin: 10px 0 0;
  color: var(--c-text-muted);
  font-size: 12px;
}

.profile-wrap {
  margin-top: 10px;
  border: 1px solid var(--c-border);
  border-radius: 10px;
  background: #fafbfc;
  padding: 10px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px;
  align-items: center;
}

.avatar-wrap {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid var(--c-border);
  background: #eef1f4;
  overflow: hidden;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.avatar-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-wrap span {
  color: var(--c-text-sub);
  font-size: 16px;
  font-weight: 700;
}

.profile-main {
  min-width: 0;
}

.profile-main h4 {
  margin: 0;
  color: var(--c-text-main);
  font-size: 13px;
}

.uuid,
.signature {
  margin: 4px 0 0;
  color: var(--c-text-sub);
  font-size: 12px;
  word-break: break-all;
}

.presence {
  display: block;
  margin-top: 2px;
  color: var(--c-text-muted);
  font-size: 11px;
}

.profile-actions {
  display: grid;
  gap: 8px;
  justify-items: end;
}

.reason {
  margin: 0;
  color: var(--c-text-muted);
  font-size: 11px;
  max-width: 220px;
  text-align: right;
  word-break: break-word;
}

.action-btn {
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 7px 12px;
  font-size: 12px;
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

@media (max-width: 1199px) {
  .profile-wrap {
    grid-template-columns: 1fr;
  }

  .profile-actions {
    justify-items: start;
  }

  .reason {
    max-width: none;
    text-align: left;
  }
}
</style>
