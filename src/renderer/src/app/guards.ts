import type { Pinia } from 'pinia'
import type { Router } from 'vue-router'
import { useAuthStore } from '../stores/auth.store'

export function installRouterGuards(router: Router, pinia: Pinia): void {
  router.beforeEach(async (to) => {
    const authStore = useAuthStore(pinia)
    await authStore.hydrateSession()

    const requiresAuth = Boolean(to.meta.requiresAuth)
    const guestOnly = Boolean(to.meta.guestOnly)

    if (requiresAuth && !authStore.isAuthenticated) {
      return { name: 'login' }
    }

    if (guestOnly && authStore.isAuthenticated) {
      return { name: 'chat' }
    }

    return true
  })
}
