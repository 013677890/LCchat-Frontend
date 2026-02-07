<script setup lang="ts">
import { computed, ref } from 'vue'

export interface ChangeEmailPayload {
  newEmail: string
  verifyCode: string
}

export interface ChangePasswordPayload {
  oldPassword: string
  newPassword: string
}

export interface DeleteAccountPayload {
  password: string
  reason?: string
}

const props = defineProps<{
  currentEmail: string
  sendingCode?: boolean
  codeCooldownSeconds?: number
  savingEmail?: boolean
  savingPassword?: boolean
  deletingAccount?: boolean
  message?: string
  errorMessage?: string
}>()

const emit = defineEmits<{
  requestEmailCode: [string]
  submitEmail: [ChangeEmailPayload]
  submitPassword: [ChangePasswordPayload]
  submitDelete: [DeleteAccountPayload]
  clearFeedback: []
}>()

const newEmail = ref('')
const verifyCode = ref('')
const oldPassword = ref('')
const newPassword = ref('')
const deletePassword = ref('')
const deleteReason = ref('')
const deleteConfirmText = ref('')

const canSendCode = computed(() => {
  return (
    !props.sendingCode &&
    (props.codeCooldownSeconds || 0) <= 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.value.trim()) &&
    newEmail.value.trim() !== props.currentEmail
  )
})

const canSubmitEmail = computed(() => {
  return (
    !props.savingEmail &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.value.trim()) &&
    verifyCode.value.trim().length === 6 &&
    newEmail.value.trim() !== props.currentEmail
  )
})

const canSubmitPassword = computed(() => {
  const oldVal = oldPassword.value.trim()
  const newVal = newPassword.value.trim()
  return (
    !props.savingPassword &&
    oldVal.length >= 8 &&
    oldVal.length <= 16 &&
    newVal.length >= 8 &&
    newVal.length <= 16 &&
    oldVal !== newVal
  )
})

const canSubmitDelete = computed(() => {
  const password = deletePassword.value.trim()
  return (
    !props.deletingAccount &&
    password.length >= 6 &&
    password.length <= 20 &&
    deleteConfirmText.value.trim().toUpperCase() === 'DELETE'
  )
})

const sendCodeLabel = computed(() => {
  if (props.sendingCode) {
    return '发送中...'
  }

  const cooldown = props.codeCooldownSeconds || 0
  if (cooldown > 0) {
    return `${cooldown}s后重试`
  }

  return '发送验证码'
})

function clearFeedback(): void {
  emit('clearFeedback')
}

function handleSendCode(): void {
  if (!canSendCode.value) {
    return
  }
  emit('requestEmailCode', newEmail.value.trim())
}

function handleSubmitEmail(): void {
  if (!canSubmitEmail.value) {
    return
  }
  emit('submitEmail', {
    newEmail: newEmail.value.trim(),
    verifyCode: verifyCode.value.trim()
  })
}

function handleSubmitPassword(): void {
  if (!canSubmitPassword.value) {
    return
  }
  emit('submitPassword', {
    oldPassword: oldPassword.value.trim(),
    newPassword: newPassword.value.trim()
  })
}

function handleSubmitDelete(): void {
  if (!canSubmitDelete.value) {
    return
  }

  const normalizedReason = deleteReason.value.trim()
  emit('submitDelete', {
    password: deletePassword.value.trim(),
    reason: normalizedReason || undefined
  })
}
</script>

<template>
  <section class="security-card">
    <header class="security-header">
      <h3>安全设置</h3>
      <p>当前邮箱：{{ props.currentEmail || '-' }}</p>
    </header>

    <div class="security-grid">
      <section class="block">
        <h4>换绑邮箱</h4>
        <label class="field">
          <span>新邮箱</span>
          <input
            v-model="newEmail"
            type="email"
            maxlength="64"
            placeholder="请输入新邮箱"
            @input="clearFeedback"
          />
        </label>

        <div class="code-row">
          <label class="field code-field">
            <span>验证码</span>
            <input
              v-model="verifyCode"
              maxlength="6"
              placeholder="6位验证码"
              @input="clearFeedback"
            />
          </label>
          <button
            type="button"
            class="btn btn--ghost"
            :disabled="!canSendCode"
            @click="handleSendCode"
          >
            {{ sendCodeLabel }}
          </button>
        </div>

        <button
          type="button"
          class="btn btn--primary"
          :disabled="!canSubmitEmail"
          @click="handleSubmitEmail"
        >
          {{ props.savingEmail ? '提交中...' : '确认换绑邮箱' }}
        </button>
      </section>

      <section class="block">
        <h4>修改密码</h4>
        <label class="field">
          <span>旧密码</span>
          <input
            v-model="oldPassword"
            type="password"
            maxlength="16"
            placeholder="8-16位"
            @input="clearFeedback"
          />
        </label>
        <label class="field">
          <span>新密码</span>
          <input
            v-model="newPassword"
            type="password"
            maxlength="16"
            placeholder="8-16位且与旧密码不同"
            @input="clearFeedback"
          />
        </label>

        <button
          type="button"
          class="btn btn--primary"
          :disabled="!canSubmitPassword"
          @click="handleSubmitPassword"
        >
          {{ props.savingPassword ? '提交中...' : '确认修改密码' }}
        </button>
      </section>

      <section class="block block--danger">
        <h4>注销账号</h4>
        <p class="danger-note">注销后账号将进入可恢复窗口，期间功能不可用。</p>

        <label class="field">
          <span>密码</span>
          <input
            v-model="deletePassword"
            type="password"
            maxlength="20"
            placeholder="输入当前密码确认"
            @input="clearFeedback"
          />
        </label>

        <label class="field">
          <span>注销原因（可选）</span>
          <input
            v-model="deleteReason"
            maxlength="255"
            placeholder="例如：长期不再使用"
            @input="clearFeedback"
          />
        </label>

        <label class="field">
          <span>确认词（输入 DELETE）</span>
          <input
            v-model="deleteConfirmText"
            maxlength="16"
            placeholder="DELETE"
            @input="clearFeedback"
          />
        </label>

        <button
          type="button"
          class="btn btn--danger"
          :disabled="!canSubmitDelete"
          @click="handleSubmitDelete"
        >
          {{ props.deletingAccount ? '提交中...' : '确认注销账号' }}
        </button>
      </section>
    </div>

    <p v-if="props.message" class="feedback feedback--ok">{{ props.message }}</p>
    <p v-if="props.errorMessage" class="feedback feedback--err">{{ props.errorMessage }}</p>
  </section>
</template>

<style scoped>
.security-card {
  border: 1px solid var(--c-border);
  border-radius: 14px;
  background: #fff;
  padding: 14px;
  box-shadow: var(--shadow-1);
}

.security-header h3 {
  margin: 0;
  font-size: 14px;
  color: var(--c-text-main);
}

.security-header p {
  margin: 6px 0 0;
  color: var(--c-text-muted);
  font-size: 12px;
}

.security-grid {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.block {
  border: 1px solid var(--c-border);
  border-radius: 10px;
  padding: 10px;
  display: grid;
  gap: 8px;
  background: #fafbfc;
}

.block h4 {
  margin: 0;
  font-size: 13px;
  color: var(--c-text-main);
}

.block--danger {
  border-color: rgba(245, 63, 63, 0.28);
  background: #fff7f7;
}

.danger-note {
  margin: 0;
  font-size: 12px;
  color: #b02222;
  line-height: 1.5;
}

.field {
  display: grid;
  gap: 6px;
}

.field span {
  color: var(--c-text-sub);
  font-size: 12px;
}

.field input {
  border: 1px solid var(--c-border);
  border-radius: 8px;
  height: 36px;
  padding: 0 10px;
  font-size: 13px;
  color: var(--c-text-main);
  background: #fff;
  outline: none;
}

.field input:focus {
  border-color: var(--c-primary);
}

.code-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: end;
}

.code-field {
  min-width: 0;
}

.btn {
  border: 1px solid transparent;
  border-radius: 8px;
  height: 36px;
  padding: 0 12px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease-out;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn--ghost {
  color: var(--c-text-sub);
  background: #fff;
  border-color: var(--c-border);
}

.btn--ghost:hover:not(:disabled) {
  border-color: #c7ced7;
}

.btn--primary {
  color: #fff;
  background: var(--c-primary);
}

.btn--primary:hover:not(:disabled) {
  background: var(--c-primary-hover);
}

.btn--danger {
  color: #fff;
  background: var(--c-danger);
}

.btn--danger:hover:not(:disabled) {
  opacity: 0.9;
}

.feedback {
  margin: 10px 0 0;
  font-size: 12px;
}

.feedback--ok {
  color: var(--c-success);
}

.feedback--err {
  color: var(--c-danger);
}

@media (max-width: 1199px) {
  .security-grid {
    grid-template-columns: 1fr;
  }
}
</style>
