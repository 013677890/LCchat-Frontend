<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { VerifyCodeType } from '../api'
import { useAuthStore } from '../../../stores/auth.store'
import { useDeviceStore } from '../../../stores/device.store'
import { useSessionStore } from '../../../stores/session.store'
import { normalizeErrorMessage } from '../../../shared/utils/error'

type AuthMode = 'password' | 'code' | 'register' | 'reset'

const router = useRouter()
const authStore = useAuthStore()
const deviceStore = useDeviceStore()
const sessionStore = useSessionStore()

const mode = ref<AuthMode>('password')
const account = ref('')
const password = ref('')
const loginEmail = ref('')
const loginCode = ref('')
const registerEmail = ref('')
const registerPassword = ref('')
const registerCode = ref('')
const registerNickname = ref('')
const registerTelephone = ref('')
const resetEmail = ref('')
const resetCode = ref('')
const resetPassword = ref('')
const loading = ref(false)
const sendingCode = ref(false)
const codeCooldownSeconds = ref(0)
let codeCooldownTimer: ReturnType<typeof setInterval> | null = null

const message = ref('')
const errorMessage = ref('')
const deviceId = ref('')

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function clearFeedback(): void {
  message.value = ''
  errorMessage.value = ''
}

function stopCodeCooldown(): void {
  if (codeCooldownTimer) {
    clearInterval(codeCooldownTimer)
    codeCooldownTimer = null
  }
}

function startCodeCooldown(seconds: number): void {
  stopCodeCooldown()
  codeCooldownSeconds.value = Math.max(0, Math.trunc(seconds))
  if (codeCooldownSeconds.value <= 0) {
    return
  }

  codeCooldownTimer = setInterval(() => {
    if (codeCooldownSeconds.value <= 1) {
      stopCodeCooldown()
      codeCooldownSeconds.value = 0
      return
    }
    codeCooldownSeconds.value -= 1
  }, 1000)
}

function getActiveVerifyCodeType(): VerifyCodeType | null {
  if (mode.value === 'register') {
    return 1
  }
  if (mode.value === 'code') {
    return 2
  }
  if (mode.value === 'reset') {
    return 3
  }
  return null
}

const verifyEmail = computed(() => {
  if (mode.value === 'register') {
    return registerEmail.value.trim()
  }
  if (mode.value === 'code') {
    return loginEmail.value.trim()
  }
  if (mode.value === 'reset') {
    return resetEmail.value.trim()
  }
  return ''
})

const canSendCode = computed(() => {
  return Boolean(
    getActiveVerifyCodeType() &&
    !sendingCode.value &&
    codeCooldownSeconds.value <= 0 &&
    isValidEmail(verifyEmail.value)
  )
})

const sendCodeLabel = computed(() => {
  if (sendingCode.value) {
    return '发送中...'
  }
  if (codeCooldownSeconds.value > 0) {
    return `${codeCooldownSeconds.value}s后重试`
  }
  return '发送验证码'
})

function switchMode(nextMode: AuthMode): void {
  mode.value = nextMode
  clearFeedback()
  stopCodeCooldown()
  codeCooldownSeconds.value = 0
}

async function handleSendCode(): Promise<void> {
  const type = getActiveVerifyCodeType()
  if (!type || !canSendCode.value) {
    return
  }

  sendingCode.value = true
  clearFeedback()
  try {
    const expireSeconds = await authStore.requestVerifyCode(verifyEmail.value, type)
    message.value = '验证码已发送，请注意查收邮箱。'
    startCodeCooldown(expireSeconds || 60)
  } catch (error) {
    errorMessage.value = normalizeErrorMessage(error)
  } finally {
    sendingCode.value = false
  }
}

async function signInAndEnterWorkspace(): Promise<void> {
  await sessionStore.bootstrap(authStore.userUuid)
  await router.replace({ name: 'chat' })
}

async function handleSubmitPasswordLogin(): Promise<void> {
  await authStore.signInWithPassword(account.value, password.value)
  await signInAndEnterWorkspace()
}

async function handleSubmitCodeLogin(): Promise<void> {
  await authStore.signInWithCode(loginEmail.value, loginCode.value)
  await signInAndEnterWorkspace()
}

async function handleSubmitRegister(): Promise<void> {
  await authStore.registerWithEmail({
    email: registerEmail.value,
    verifyCode: registerCode.value,
    password: registerPassword.value,
    nickname: registerNickname.value || undefined,
    telephone: registerTelephone.value || undefined
  })
  message.value = '注册成功，请使用账号密码登录。'
  account.value = registerEmail.value
  password.value = ''
  switchMode('password')
}

async function handleSubmitResetPassword(): Promise<void> {
  await authStore.resetPasswordByEmail({
    email: resetEmail.value,
    verifyCode: resetCode.value,
    newPassword: resetPassword.value
  })
  message.value = '密码重置成功，请使用新密码登录。'
  account.value = resetEmail.value
  password.value = ''
  switchMode('password')
}

async function handleSubmit(): Promise<void> {
  loading.value = true
  clearFeedback()

  try {
    if (mode.value === 'password') {
      await handleSubmitPasswordLogin()
      return
    }
    if (mode.value === 'code') {
      await handleSubmitCodeLogin()
      return
    }
    if (mode.value === 'register') {
      await handleSubmitRegister()
      return
    }
    await handleSubmitResetPassword()
  } catch (error) {
    errorMessage.value = normalizeErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function handleDemoLogin(): Promise<void> {
  loading.value = true
  clearFeedback()

  try {
    await authStore.signInWithDemoAccount(account.value || 'demo-user')
    await signInAndEnterWorkspace()
  } catch (error) {
    errorMessage.value = normalizeErrorMessage(error)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  deviceId.value = await deviceStore.ensureDeviceId()
})

onBeforeUnmount(() => {
  stopCodeCooldown()
})
</script>

<template>
  <main class="login-page">
    <section class="card">
      <header>
        <h1>LCchat</h1>
        <p>Vue + Electron IM 客户端</p>
      </header>

      <nav class="mode-switch">
        <button
          type="button"
          :class="{ active: mode === 'password' }"
          @click="switchMode('password')"
        >
          密码登录
        </button>
        <button type="button" :class="{ active: mode === 'code' }" @click="switchMode('code')">
          验证码登录
        </button>
        <button
          type="button"
          :class="{ active: mode === 'register' }"
          @click="switchMode('register')"
        >
          注册
        </button>
        <button type="button" :class="{ active: mode === 'reset' }" @click="switchMode('reset')">
          重置密码
        </button>
      </nav>

      <div v-if="mode === 'password'" class="form-grid">
        <label class="field">
          <span>账号（邮箱或手机号）</span>
          <input v-model.trim="account" placeholder="例如: demo@test.com" />
        </label>
        <label class="field">
          <span>密码</span>
          <input v-model="password" type="password" placeholder="输入登录密码" />
        </label>
      </div>

      <div v-else-if="mode === 'code'" class="form-grid">
        <label class="field">
          <span>邮箱</span>
          <input v-model.trim="loginEmail" type="email" placeholder="请输入邮箱" />
        </label>
        <div class="code-row">
          <label class="field">
            <span>验证码</span>
            <input v-model.trim="loginCode" maxlength="6" placeholder="输入6位验证码" />
          </label>
          <button type="button" class="ghost-btn" :disabled="!canSendCode" @click="handleSendCode">
            {{ sendCodeLabel }}
          </button>
        </div>
      </div>

      <div v-else-if="mode === 'register'" class="form-grid">
        <label class="field">
          <span>邮箱</span>
          <input v-model.trim="registerEmail" type="email" placeholder="请输入邮箱" />
        </label>
        <div class="code-row">
          <label class="field">
            <span>验证码</span>
            <input v-model.trim="registerCode" maxlength="6" placeholder="输入6位验证码" />
          </label>
          <button type="button" class="ghost-btn" :disabled="!canSendCode" @click="handleSendCode">
            {{ sendCodeLabel }}
          </button>
        </div>
        <label class="field">
          <span>密码</span>
          <input v-model="registerPassword" type="password" placeholder="6-20位密码" />
        </label>
        <label class="field">
          <span>昵称（可选）</span>
          <input v-model.trim="registerNickname" maxlength="20" placeholder="例如: 小明" />
        </label>
        <label class="field">
          <span>手机号（可选）</span>
          <input v-model.trim="registerTelephone" maxlength="11" placeholder="11位手机号" />
        </label>
      </div>

      <div v-else class="form-grid">
        <label class="field">
          <span>邮箱</span>
          <input v-model.trim="resetEmail" type="email" placeholder="请输入邮箱" />
        </label>
        <div class="code-row">
          <label class="field">
            <span>验证码</span>
            <input v-model.trim="resetCode" maxlength="6" placeholder="输入6位验证码" />
          </label>
          <button type="button" class="ghost-btn" :disabled="!canSendCode" @click="handleSendCode">
            {{ sendCodeLabel }}
          </button>
        </div>
        <label class="field">
          <span>新密码</span>
          <input v-model="resetPassword" type="password" placeholder="请输入新密码" />
        </label>
      </div>

      <p class="device">设备 ID: {{ deviceId || '加载中...' }}</p>
      <p v-if="message" class="message">{{ message }}</p>
      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

      <div class="actions">
        <button type="button" :disabled="loading" @click="handleSubmit">
          <template v-if="loading">处理中...</template>
          <template v-else-if="mode === 'password'">账号登录</template>
          <template v-else-if="mode === 'code'">验证码登录</template>
          <template v-else-if="mode === 'register'">注册账号</template>
          <template v-else>确认重置</template>
        </button>
        <button
          v-if="mode === 'password'"
          type="button"
          class="secondary"
          :disabled="loading"
          @click="handleDemoLogin"
        >
          演示登录
        </button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background:
    radial-gradient(circle at 12% 18%, rgba(7, 193, 96, 0.18) 0, rgba(7, 193, 96, 0) 42%),
    radial-gradient(circle at 85% 0%, rgba(65, 90, 130, 0.14) 0, rgba(65, 90, 130, 0) 35%),
    var(--c-bg-app);
  padding: 20px;
}

.card {
  width: min(420px, 100%);
  background: #fff;
  border-radius: 16px;
  padding: 26px;
  box-shadow: var(--shadow-2);
  border: 1px solid var(--c-border);
}

.card header h1 {
  margin: 0;
  font-size: 28px;
  color: var(--c-text-main);
}

.card header p {
  margin: 6px 0 20px;
  color: var(--c-text-sub);
  font-size: 14px;
}

.mode-switch {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  margin-bottom: 14px;
}

.mode-switch button {
  margin: 0;
  height: 34px;
  border: 1px solid var(--c-border);
  border-radius: 8px;
  background: #fff;
  color: var(--c-text-sub);
  font-size: 12px;
  font-weight: 500;
}

.mode-switch button.active {
  border-color: var(--c-primary);
  color: var(--c-primary);
  background: rgba(7, 193, 96, 0.08);
}

.mode-switch button:hover {
  background: #f6f8f8;
}

.form-grid {
  display: grid;
  gap: 10px;
}

.field {
  display: grid;
  gap: 8px;
}

.field span {
  font-size: 13px;
  color: var(--c-text-sub);
}

.field input {
  width: 100%;
  border: 1px solid var(--c-border);
  border-radius: 10px;
  height: 40px;
  padding: 0 12px;
  font-size: 14px;
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

.device {
  margin: 12px 0 0;
  color: var(--c-text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.message {
  margin: 12px 0 0;
  color: var(--c-success);
  font-size: 13px;
}

.error {
  margin: 12px 0 0;
  color: var(--c-danger);
  font-size: 13px;
}

button {
  margin-top: 18px;
  width: 100%;
  height: 42px;
  border: none;
  border-radius: 10px;
  background: var(--c-primary);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease-out;
}

button:hover {
  background: var(--c-primary-hover);
}

button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.actions {
  margin-top: 18px;
  display: grid;
  gap: 10px;
}

.ghost-btn {
  margin: 0;
  width: auto;
  min-width: 120px;
  height: 40px;
  border: 1px solid var(--c-border);
  border-radius: 10px;
  background: #fff;
  color: var(--c-text-main);
  padding: 0 12px;
  font-size: 13px;
  font-weight: 500;
}

.ghost-btn:hover:not(:disabled) {
  background: #f5f7f8;
}

.secondary {
  background: #ecf2ef;
  color: var(--c-text-main);
}

.secondary:hover {
  background: #dfe9e3;
}
</style>
