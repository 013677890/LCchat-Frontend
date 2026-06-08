<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { VerifyCodeType } from '../api'
import { useAuthStore } from '../../../stores/auth.store'
import { useDeviceStore } from '../../../stores/device.store'
import { useSessionStore } from '../../../stores/session.store'
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

onMounted(async () => {
  deviceId.value = await deviceStore.ensureDeviceId()
})

onBeforeUnmount(() => {
  stopCodeCooldown()
})
</script>

<template>
  <main class="login-page">
    <!-- Fluid background ambient glowing orbs -->
    <div class="ambient-orb orb-1"></div>
    <div class="ambient-orb orb-2"></div>
    <div class="ambient-orb orb-3"></div>

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
          <input v-model.trim="account" placeholder="例如: user@example.com" />
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
  background: #f1f5f9; /* Slate 100 base */
  padding: 20px;
  overflow: hidden;
}

/* Dynamic Ambient Floating Mesh Orbs */
.ambient-orb {
  position: absolute;
  border-radius: var(--radius-full);
  filter: blur(100px);
  opacity: 0.55;
  mix-blend-mode: multiply;
  z-index: 1;
  pointer-events: none;
  animation: floatOrb 22s infinite ease-in-out;
}

.orb-1 {
  width: 450px;
  height: 450px;
  background: radial-gradient(circle, rgba(0, 198, 112, 0.4) 0%, rgba(0, 198, 112, 0) 70%);
  top: -10%;
  left: 15%;
  animation-duration: 25s;
}

.orb-2 {
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(37, 99, 235, 0.35) 0%, rgba(37, 99, 235, 0) 70%);
  bottom: -15%;
  right: 10%;
  animation-duration: 28s;
  animation-delay: -5s;
}

.orb-3 {
  width: 380px;
  height: 380px;
  background: radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, rgba(16, 185, 129, 0) 70%);
  top: 40%;
  right: 40%;
  animation-duration: 20s;
  animation-delay: -10s;
}

@keyframes floatOrb {
  0% {
    transform: translate(0px, 0px) scale(1) rotate(0deg);
  }
  33% {
    transform: translate(40px, -60px) scale(1.1) rotate(120deg);
  }
  66% {
    transform: translate(-30px, 40px) scale(0.9) rotate(240deg);
  }
  100% {
    transform: translate(0px, 0px) scale(1) rotate(360deg);
  }
}

.login-page::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(0, 0, 0, 0.02) 1px, transparent 1px);
  background-size: 24px 24px;
  pointer-events: none;
  z-index: 2;
}

.card {
  position: relative;
  z-index: 3;
  width: min(440px, 100%);
  background: rgba(255, 255, 255, 0.72); /* High transparency glass */
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-radius: var(--radius-xl);
  padding: 40px 32px;
  box-shadow: 
    0 24px 60px -15px rgba(0, 198, 112, 0.12), 
    0 8px 24px -10px rgba(0, 0, 0, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.4);
  animation: floatUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes floatUp {
  from {
    opacity: 0;
    transform: translateY(24px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.card header {
  text-align: center;
  margin-bottom: 32px;
}

.card header h1 {
  margin: 0;
  font-size: 34px;
  font-weight: 800;
  background: linear-gradient(135deg, var(--c-primary), #009A57);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: -1px;
}

.card header p {
  margin: 8px 0 0;
  color: var(--c-text-sub);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.2px;
}

.mode-switch {
  display: flex;
  background: rgba(0, 0, 0, 0.03);
  padding: 3px;
  border-radius: var(--radius-md);
  margin-bottom: 24px;
  border: 1px solid rgba(0, 0, 0, 0.02);
}

.mode-switch button {
  flex: 1;
  height: 34px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--c-text-sub);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.mode-switch button.active {
  color: var(--c-text-main);
  background: #fff;
  box-shadow: var(--shadow-sm);
}

.mode-switch button:hover:not(.active) {
  color: var(--c-text-main);
  background: rgba(255, 255, 255, 0.4);
}

.form-grid {
  display: grid;
  gap: 16px;
  animation: formFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes formFadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field span {
  font-size: 12px;
  font-weight: 700;
  color: var(--c-text-main);
  margin-left: 2px;
}

.field input {
  width: 100%;
  border: 1.5px solid rgba(0, 0, 0, 0.08);
  border-radius: var(--radius-md);
  height: 44px;
  padding: 0 16px;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  transition: all var(--duration-fast) var(--ease-out);
}

.field input:hover {
  background: rgba(255, 255, 255, 0.8);
  border-color: rgba(0, 198, 112, 0.3);
}

.field input:focus {
  background: #fff;
  border-color: var(--c-primary);
  box-shadow: 0 0 0 4px var(--c-primary-soft);
  outline: none;
  transform: translateY(-1px);
}

.field input::placeholder {
  color: var(--c-text-muted);
  opacity: 0.7;
}

.code-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: end;
}

.device {
  margin: 20px 0 0;
  color: var(--c-text-muted);
  font-size: 11px;
  text-align: center;
  font-family: 'Fira Code', Consolas, monospace;
  opacity: 0.8;
  letter-spacing: -0.2px;
}

.message, .error {
  margin: 16px 0 0;
  font-size: 13px;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  text-align: center;
  font-weight: 600;
  animation: messageSlideDown 0.25s var(--ease-spring) forwards;
}

@keyframes messageSlideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

.message {
  background: rgba(82, 196, 26, 0.08);
  color: #389e0d;
  border: 1px solid rgba(82, 196, 26, 0.15);
}

.error {
  background: rgba(255, 77, 79, 0.08);
  color: #cf1322;
  border: 1px solid rgba(255, 77, 79, 0.15);
}

.actions {
  margin-top: 28px;
  display: grid;
  gap: 12px;
}

button {
  width: 100%;
  height: 46px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--c-primary);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 198, 112, 0.25);
  transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.1);
}

button:hover:not(:disabled) {
  background: var(--c-primary-hover);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 198, 112, 0.35);
}

button:active:not(:disabled) {
  transform: scale(0.97) translateY(0);
  box-shadow: 0 2px 6px rgba(0, 198, 112, 0.25);
}

button:disabled {
  background: var(--c-text-muted);
  box-shadow: none;
  opacity: 0.5;
  cursor: not-allowed;
}

.ghost-btn {
  margin: 0;
  width: auto;
  min-width: 120px;
  height: 44px;
  border: 1.5px solid rgba(0, 0, 0, 0.08);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.4);
  color: var(--c-text-main);
  padding: 0 16px;
  font-size: 13px;
  font-weight: 700;
  box-shadow: none;
}

.ghost-btn:hover:not(:disabled) {
  background: #fff;
  border-color: rgba(0, 198, 112, 0.4);
  color: var(--c-primary-active);
  box-shadow: var(--shadow-sm);
}

.secondary {
  background: rgba(0, 0, 0, 0.03);
  color: var(--c-text-main);
  box-shadow: none;
  border: 1px solid rgba(0, 0, 0, 0.03);
}

.secondary:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.06);
  border-color: rgba(0, 0, 0, 0.02);
  box-shadow: none;
}

.secondary:active:not(:disabled) {
  transform: scale(0.97);
}
</style>
