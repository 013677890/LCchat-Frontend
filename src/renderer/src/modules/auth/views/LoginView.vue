<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../../stores/auth.store'
import { useDeviceStore } from '../../../stores/device.store'
import { useSessionStore } from '../../../stores/session.store'
import { normalizeErrorMessage } from '../../../shared/utils/error'

const router = useRouter()
const authStore = useAuthStore()
const deviceStore = useDeviceStore()
const sessionStore = useSessionStore()

const account = ref('demo-user')
const loading = ref(false)
const errorMessage = ref('')
const deviceId = ref('')

async function handleSubmit(): Promise<void> {
  loading.value = true
  errorMessage.value = ''

  try {
    await authStore.signInWithDemoAccount(account.value)
    await sessionStore.bootstrap(authStore.userUuid)
    await router.replace({ name: 'chat' })
  } catch (error) {
    errorMessage.value = normalizeErrorMessage(error)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  deviceId.value = await deviceStore.ensureDeviceId()
})
</script>

<template>
  <main class="login-page">
    <section class="card">
      <header>
        <h1>LCchat</h1>
        <p>Vue + Electron IM 客户端</p>
      </header>

      <label class="field">
        <span>账号标识（演示）</span>
        <input v-model.trim="account" placeholder="输入用户 UUID 或昵称" />
      </label>

      <p class="device">设备 ID: {{ deviceId || '加载中...' }}</p>
      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

      <button type="button" :disabled="loading" @click="handleSubmit">
        {{ loading ? '登录中...' : '进入 LCchat' }}
      </button>
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

.device {
  margin: 12px 0 0;
  color: var(--c-text-muted);
  font-size: 12px;
  line-height: 1.5;
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
</style>
