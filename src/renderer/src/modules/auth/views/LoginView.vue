<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { VerifyCodeType } from '../api'
import { useAuthStore } from '../../../stores/auth.store'
import { useDeviceStore } from '../../../stores/device.store'
import { useSessionStore } from '../../../stores/session.store'
import { normalizeErrorMessage } from '../../../shared/utils/error'
import { resolveAuthErrorMessage, type AuthAction } from '../error-message'

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
    errorMessage.value = resolveAuthErrorMessage('send_code', error)
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
    let action: AuthAction = 'password_login'
    if (mode.value === 'code') {
      action = 'code_login'
    } else if (mode.value === 'register') {
      action = 'register'
    } else if (mode.value === 'reset') {
      action = 'reset_password'
    }
    errorMessage.value = resolveAuthErrorMessage(action, error)
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
  position: relative;
  /* 现代动态感极简背景 */
  background: 
    radial-gradient(circle at 10% 20%, rgba(0, 198, 112, 0.15) 0, rgba(0, 198, 112, 0) 40%),
    radial-gradient(circle at 90% 80%, rgba(45, 100, 255, 0.12) 0, rgba(45, 100, 255, 0) 45%),
    var(--c-bg-app);
  padding: 20px;
  overflow: hidden;
}

/* 增加一层氛围装饰点阵或条纹（可选） */
.login-page::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(0, 0, 0, 0.03) 1px, transparent 1px);
  background-size: 24px 24px;
  pointer-events: none;
  z-index: 1;
}

.card {
  position: relative;
  z-index: 2;
  width: min(440px, 100%);
  background: rgba(255, 255, 255, 0.85); /* 半透明背景 */
  backdrop-filter: var(--blur-lg);
  -webkit-backdrop-filter: var(--blur-lg);
  border-radius: var(--radius-xl);
  padding: 40px 32px;
  box-shadow: var(--shadow-float);
  border: 1px solid rgba(255, 255, 255, 0.6);
  animation: floatUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes floatUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.card header {
  text-align: center;
  margin-bottom: 32px;
}

.card header h1 {
  margin: 0;
  font-size: 32px;
  font-weight: 800;
  background: linear-gradient(135deg, var(--c-primary), #009A57);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: -0.5px;
}

.card header p {
  margin: 8px 0 0;
  color: var(--c-text-sub);
  font-size: 15px;
  font-weight: 500;
}

.mode-switch {
  display: flex;
  background: rgba(0, 0, 0, 0.03);
  padding: 4px;
  border-radius: var(--radius-md);
  margin-bottom: 24px;
  position: relative;
}

.mode-switch button {
  flex: 1;
  height: 36px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--c-text-sub);
  font-size: 13px;
  font-weight: 600;
  position: relative;
  z-index: 2;
}

.mode-switch button.active {
  color: var(--c-text-main);
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); /* 滑动式的高亮质感 */
}

.mode-switch button:hover:not(.active) {
  color: var(--c-text-main);
}

.form-grid {
  display: grid;
  gap: 16px;
  animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateX(-10px); }
  to { opacity: 1; transform: translateX(0); }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field span {
  font-size: 13px;
  font-weight: 600;
  color: var(--c-text-main);
  margin-left: 2px;
}

.field input {
  width: 100%;
  border: 1.5px solid var(--c-border);
  border-radius: var(--radius-md);
  height: 46px;
  padding: 0 16px;
  font-size: 15px;
  background: rgba(255, 255, 255, 0.6);
  transition: all 0.25s ease;
}

.field input:hover {
  background: #fff;
  border-color: rgba(0, 198, 112, 0.4);
}

.field input:focus {
  background: #fff;
  border-color: var(--c-primary);
  box-shadow: 0 0 0 4px var(--c-primary-soft);
  outline: none;
}

.field input::placeholder {
  color: var(--c-text-muted);
}

.code-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: end;
}

.device {
  margin: 16px 0 0;
  color: var(--c-text-muted);
  font-size: 12px;
  text-align: center;
  font-family: monospace;
}

.message, .error {
  margin: 16px 0 0;
  font-size: 14px;
  padding: 12px 16px;
  border-radius: var(--radius-md);
  text-align: center;
  font-weight: 500;
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.message {
  background: rgba(82, 196, 26, 0.1);
  color: var(--c-success);
  border: 1px solid rgba(82, 196, 26, 0.2);
}

.error {
  background: rgba(255, 77, 79, 0.1);
  color: var(--c-danger);
  border: 1px solid rgba(255, 77, 79, 0.2);
}

.actions {
  margin-top: 28px;
  display: grid;
  gap: 12px;
}

button {
  width: 100%;
  height: 48px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--c-primary);
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 198, 112, 0.3);
  transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.1);
}

button:hover:not(:disabled) {
  background: var(--c-primary-hover);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 198, 112, 0.4);
}

button:active:not(:disabled) {
  transform: translateY(1px);
  box-shadow: 0 2px 8px rgba(0, 198, 112, 0.3);
}

button:disabled {
  background: var(--c-text-muted);
  box-shadow: none;
  opacity: 0.6;
  cursor: not-allowed;
}

.ghost-btn {
  margin: 0;
  width: auto;
  min-width: 130px;
  height: 46px;
  border: 1.5px solid var(--c-border);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.6);
  color: var(--c-text-main);
  padding: 0 16px;
  font-size: 14px;
  font-weight: 600;
  box-shadow: none;
}

.ghost-btn:hover:not(:disabled) {
  background: #fff;
  border-color: var(--c-text-sub);
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.secondary {
  background: rgba(0, 0, 0, 0.04);
  color: var(--c-text-main);
  box-shadow: none;
}

.secondary:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.08);
  box-shadow: none;
}
</style>
