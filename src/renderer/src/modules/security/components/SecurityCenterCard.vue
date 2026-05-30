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
  border: 1px solid rgba(0, 0, 0, 0.045);
  border-radius: var(--radius-xl);
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: var(--blur-md);
  -webkit-backdrop-filter: var(--blur-md);
  padding: 24px;
  box-shadow: 
    0 12px 32px -10px rgba(0, 0, 0, 0.04), 
    0 2px 8px -2px rgba(0, 0, 0, 0.02),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
  transition: all var(--duration-normal) var(--ease-out);
}

.security-card:hover {
  background: rgba(255, 255, 255, 0.8);
  border-color: rgba(0, 198, 112, 0.15);
  box-shadow: 
    0 16px 40px -12px rgba(0, 198, 112, 0.04), 
    0 2px 10px -2px rgba(0, 0, 0, 0.03);
}

.security-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--c-text-main);
}

.security-header p {
  margin: 6px 0 0;
  color: var(--c-text-sub);
  font-size: 13px;
  font-weight: 500;
}

.security-grid {
  margin-top: 18px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.block {
  border: 1px solid rgba(0, 0, 0, 0.045);
  border-radius: var(--radius-lg);
  padding: 16px;
  display: grid;
  gap: 12px;
  background: rgba(0, 0, 0, 0.015);
  align-content: start;
  transition: all var(--duration-fast) var(--ease-out);
}

.block:hover {
  background: #fff;
  border-color: rgba(0, 198, 112, 0.15);
  box-shadow: var(--shadow-sm);
}

.block h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--c-text-main);
}

.block--danger {
  border-color: rgba(245, 63, 63, 0.15);
  background: rgba(245, 63, 63, 0.02);
}

.block--danger:hover {
  background: #fff;
  border-color: rgba(245, 63, 63, 0.3);
  box-shadow: 0 4px 12px rgba(245, 63, 63, 0.05);
}

.danger-note {
  margin: 0;
  font-size: 12px;
  color: #b02222;
  line-height: 1.5;
  opacity: 0.85;
}

.field {
  display: grid;
  gap: 6px;
}

.field span {
  color: var(--c-text-sub);
  font-size: 12px;
  font-weight: 600;
  margin-left: 2px;
}

.field input {
  border: 1.5px solid rgba(0, 0, 0, 0.08);
  border-radius: var(--radius-md);
  height: 38px;
  padding: 0 12px;
  font-size: 13px;
  color: var(--c-text-main);
  background: rgba(255, 255, 255, 0.5);
  outline: none;
  transition: all var(--duration-fast) var(--ease-out);
}

.field input:hover {
  background: #fff;
  border-color: rgba(0, 198, 112, 0.3);
}

.field input:focus {
  background: #fff;
  border-color: var(--c-primary);
  box-shadow: 0 0 0 3px var(--c-primary-soft);
  transform: translateY(-0.5px);
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
  border-radius: var(--radius-md);
  height: 38px;
  padding: 0 16px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-fast) var(--ease-out);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none !important;
}

.btn:active:not(:disabled) {
  transform: scale(0.97);
}

.btn--ghost {
  color: var(--c-text-sub);
  background: rgba(255, 255, 255, 0.5);
  border-color: rgba(0, 0, 0, 0.08);
}

.btn--ghost:hover:not(:disabled) {
  background: #fff;
  border-color: var(--c-primary);
  color: var(--c-primary-active);
}

.btn--primary {
  color: #fff;
  background: var(--c-primary);
  box-shadow: 0 2px 6px rgba(0, 198, 112, 0.2);
}

.btn--primary:hover:not(:disabled) {
  background: var(--c-primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(0, 198, 112, 0.3);
}

.btn--danger {
  color: #fff;
  background: var(--c-danger);
  box-shadow: 0 2px 6px rgba(255, 77, 79, 0.2);
}

.btn--danger:hover:not(:disabled) {
  background: #f5222d;
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(255, 77, 79, 0.3);
}

.feedback {
  margin: 14px 0 0;
  font-size: 13px;
  font-weight: 600;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  text-align: center;
  animation: feedbackSlide 0.2s var(--ease-spring) forwards;
}

@keyframes feedbackSlide {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}

.feedback--ok {
  background: rgba(82, 196, 26, 0.08);
  color: #389e0d;
  border: 1px solid rgba(82, 196, 26, 0.15);
}

.feedback--err {
  background: rgba(255, 77, 79, 0.08);
  color: #cf1322;
  border: 1px solid rgba(255, 77, 79, 0.15);
}

@media (max-width: 1199px) {
  .security-grid {
    grid-template-columns: 1fr;
  }
}
</style>
