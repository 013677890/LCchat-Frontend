<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import SidebarNav from '../../modules/chat/components/SidebarNav.vue'
import ProfileModal from '../../modules/profile/components/ProfileModal.vue'
import { useAuthStore } from '../../stores/auth.store'
import { useUserStore } from '../../stores/user.store'
import { useAppStore, type MainNavKey } from '../../stores/app.store'
import { useFriendStore } from '../../stores/friend.store'
import { useBlacklistStore } from '../../stores/blacklist.store'
import { useApplyStore } from '../../stores/apply.store'
import { useDeviceStore } from '../../stores/device.store'
import { useSessionStore } from '../../stores/session.store'
import { useConnStore } from '../../stores/conn.store'
import { toast } from 'vue-sonner'
import { resolveAssetUrl } from '../../shared/utils/asset-url'

const router = useRouter()
const route = useRoute()
const appStore = useAppStore()
const authStore = useAuthStore()
const userStore = useUserStore()
const friendStore = useFriendStore()
const blacklistStore = useBlacklistStore()
const applyStore = useApplyStore()
const deviceStore = useDeviceStore()
const sessionStore = useSessionStore()
const connStore = useConnStore()

const { activeNav } = storeToRefs(appStore)
const { profile, qrCode } = storeToRefs(userStore)
const { status: connStatus } = storeToRefs(connStore)

const isProfileModalOpen = ref(false)
const profileSavePending = ref(false)

watch(
  () => route.path,
  (path) => {
    if (path.startsWith('/contact')) {
      appStore.setActiveNav('contacts')
    } else if (path.startsWith('/discover')) {
      appStore.setActiveNav('discover')
    } else if (path.startsWith('/settings')) {
      appStore.setActiveNav('settings')
    } else if (path === '/') {
      appStore.setActiveNav('chat')
    }
  },
  { immediate: true }
)

const userLabel = computed(() => {
  if (profile.value?.payload?.nickname) {
    return profile.value.payload.nickname as string
  }
  return authStore.userUuid || 'U'
})

const userAvatarUrl = computed(() => {
  return resolveAssetUrl(profile.value?.payload?.avatar as string, { fallbackType: 'me' })
})

function handleNavChange(nextNav: MainNavKey) {
  if (nextNav === 'chat') {
    router.push('/')
  } else if (nextNav === 'contacts') {
    router.push('/contact')
  } else if (nextNav === 'discover') {
    router.push('/discover')
  } else if (nextNav === 'settings') {
    router.push('/settings')
  }
}

function handleLogout() {
  connStore.disconnect()
  authStore.signOut()
  router.replace('/login')
}

// ------ Profile Modal Logic ------
function handleAvatarClick() {
  if (!qrCode.value) {
    userStore.loadQRCode()
  }
  isProfileModalOpen.value = true
}

const profileEditorData = computed(() => {
  if (!profile.value) return null
  const payload = profile.value.payload
  const gender = typeof payload.gender === 'number' ? payload.gender : 0
  return {
    uuid: (payload.uuid as string) || authStore.userUuid,
    email: payload.email as string,
    telephone: payload.telephone as string,
    avatar: resolveAssetUrl(payload.avatar as string),
    nickname: payload.nickname as string,
    gender: gender === 1 || gender === 2 || gender === 3 ? gender : 3,
    birthday: payload.birthday as string,
    signature: payload.signature as string
  }
})

async function handleProfileSubmit(updatePayload: any) {
  if (!authStore.userUuid) return
  profileSavePending.value = true
  try {
    await userStore.updateProfile(authStore.userUuid, updatePayload)
    toast.success('个人资料已保存')
  } catch (err: any) {
    toast.error(err.message || '保存失败')
  } finally {
    profileSavePending.value = false
  }
}

async function handleProfileUploadAvatar(file: File) {
  if (!authStore.userUuid) return
  try {
    toast.loading('正在上传头像...', { id: 'avatar' })
    await userStore.uploadAvatar(authStore.userUuid, file)
    toast.success('头像更新成功', { id: 'avatar' })
  } catch (err: any) {
    toast.error(err.message || '上传头像失败', { id: 'avatar' })
  }
}

async function handleRefreshQrCode() {
  try {
    await userStore.loadQRCode()
  } catch (err: any) {
    toast.error('刷新二维码失败')
  }
}

async function handleQrCodeParsed(targetUuid: string) {
  isProfileModalOpen.value = false
  appStore.setActiveNav('discover')
  router.push({
    name: 'discover',
    query: { target: targetUuid }
  })
}

onMounted(async () => {
  await authStore.hydrateSession()
  if (!authStore.isAuthenticated) {
    await router.replace({ name: 'login' })
    return
  }

  connStore.connect()

  await Promise.all([
    userStore.loadProfile(authStore.userUuid),
    sessionStore.bootstrap(authStore.userUuid),
    friendStore.loadFriends(authStore.userUuid),
    blacklistStore.load(authStore.userUuid),
    applyStore.loadInbox(authStore.userUuid),
    applyStore.loadSent(authStore.userUuid)
  ])

  await Promise.all([
    userStore.syncFromServer(authStore.userUuid),
    friendStore.syncFromServer(authStore.userUuid),
    blacklistStore.syncFromServer(authStore.userUuid),
    applyStore.syncInboxFromServer(authStore.userUuid),
    applyStore.syncSentFromServer(authStore.userUuid),
    applyStore.syncUnreadCountFromServer(authStore.userUuid),
    deviceStore.loadDevices().catch((error) => {
      console.warn('sync devices from server failed, keep current state', error)
    })
  ])
})
</script>

<template>
  <main class="flex h-screen w-full overflow-hidden bg-[var(--c-bg-app)]">
    <SidebarNav
      :active-nav="activeNav"
      :user-label="userLabel"
      :avatar-url="userAvatarUrl"
      :discover-badge="applyStore.unreadCount"
      :conn-status="connStatus"
      @select="handleNavChange"
      @logout="handleLogout"
      @click-avatar="handleAvatarClick"
    />
    
    <section class="flex-1 min-w-0 h-full flex flex-col relative">
      <!-- Floating Glassmorphic Reconnection/Auth Banner -->
      <transition name="slide-down">
        <div 
          v-if="connStatus === 'connecting' || connStatus === 'reconnecting' || connStatus === 'auth_failed'" 
          class="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full flex items-center gap-3.5 glass-banner border shadow-lg animate-pulse-slow"
          :class="{ 'glass-banner--warning': connStatus === 'auth_failed' }"
        >
          <span class="indicator-dot" :class="{ 'indicator-dot--warning': connStatus === 'auth_failed' }"></span>
          <span class="text-xs font-semibold text-neutral-700 tracking-wide">
            {{ 
              connStatus === 'auth_failed' 
                ? '身份认证已失效，请重新登录' 
                : '正在为您连接加密通讯服务器，请稍候...' 
            }}
          </span>
          <button 
            v-if="connStatus === 'auth_failed'" 
            type="button" 
            class="text-xs px-3 py-1 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-bold transition shadow-sm hover:shadow active:scale-95 duration-100"
            @click="handleLogout"
          >
            重新登录
          </button>
        </div>
      </transition>

      <div class="flex-1 w-full h-full relative">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </section>

    <ProfileModal
      v-model:open="isProfileModalOpen"
      :profile="profileEditorData"
      :qr-code-url="qrCode?.qrCode || ''"
      :qr-code-token="qrCode?.token || ''"
      :qr-code-expire-at="qrCode?.expireAt || ''"
      :saving="profileSavePending"
      @profile-submit="handleProfileSubmit"
      @profile-upload-avatar="handleProfileUploadAvatar"
      @refresh-qr-code="handleRefreshQrCode"
      @parse-qr-code="handleQrCodeParsed"
    />
  </main>
</template>

<style scoped>
.glass-banner {
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: var(--blur-md);
  -webkit-backdrop-filter: var(--blur-md);
  border: 1px solid rgba(0, 198, 112, 0.18);
  box-shadow: var(--shadow-lg);
}

.glass-banner--warning {
  border-color: rgba(251, 191, 36, 0.4);
  background: rgba(254, 243, 199, 0.85);
}

.indicator-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background-color: var(--c-primary);
  box-shadow: 0 0 8px var(--c-primary);
  animation: pulse-dot 1.6s infinite ease-in-out;
}

.indicator-dot--warning {
  background-color: var(--c-warning);
  box-shadow: 0 0 8px var(--c-warning);
}

.animate-pulse-slow {
  animation: breathe 3s infinite ease-in-out;
}

@keyframes pulse-dot {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.3);
    opacity: 0.6;
  }
}

@keyframes breathe {
  0%, 100% {
    opacity: 0.98;
  }
  50% {
    opacity: 0.85;
  }
}

/* Slide Down transition */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: opacity 0.3s var(--ease-out), transform 0.35s var(--ease-spring);
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translate(-50%, -20px);
}
</style>
