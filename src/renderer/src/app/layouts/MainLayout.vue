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

const { activeNav } = storeToRefs(appStore)
const { profile, qrCode } = storeToRefs(userStore)

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
      :discover-badge="0"
      @select="handleNavChange"
      @logout="handleLogout"
      @click-avatar="handleAvatarClick"
    />
    
    <section class="flex-1 min-w-0 h-full flex relative">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
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
