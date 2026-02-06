import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { SessionData } from '../../../shared/types/localdb'

function createDemoSession(userUuid: string, deviceId: string): SessionData {
  return {
    userUuid,
    accessToken: `demo_access_${userUuid}`,
    refreshToken: `demo_refresh_${userUuid}`,
    expiresAt: Date.now() + 60 * 60 * 1000,
    deviceId
  }
}

export const useAuthStore = defineStore('auth', () => {
  const session = shallowRef<SessionData | null>(null)
  const hydrated = ref(false)

  const isAuthenticated = computed(() => Boolean(session.value?.accessToken))
  const userUuid = computed(() => session.value?.userUuid ?? '')

  async function hydrateSession(): Promise<void> {
    if (hydrated.value) {
      return
    }

    session.value = await window.api.session.get()
    hydrated.value = true
  }

  async function signIn(nextSession: SessionData): Promise<void> {
    session.value = nextSession
    await window.api.session.set(nextSession)
    try {
      await window.api.localdb.init()
    } catch (error) {
      console.warn('localdb init failed, continue with in-memory mode', error)
    }
  }

  async function signInWithDemoAccount(userInput: string): Promise<void> {
    const deviceId = await window.api.device.getId()
    const normalizedUser = userInput.trim() || 'demo-user'
    await signIn(createDemoSession(normalizedUser, deviceId))
  }

  async function signOut(): Promise<void> {
    session.value = null
    await window.api.session.clear()
  }

  return {
    session,
    hydrated,
    isAuthenticated,
    userUuid,
    hydrateSession,
    signIn,
    signInWithDemoAccount,
    signOut
  }
})
