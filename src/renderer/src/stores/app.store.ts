import { ref } from 'vue'
import { defineStore } from 'pinia'

export type MainNavKey = 'chat' | 'contacts' | 'discover' | 'settings'

export const useAppStore = defineStore('app', () => {
  const activeNav = ref<MainNavKey>('chat')
  const rightPaneCollapsed = ref(false)

  function setActiveNav(nextNav: MainNavKey): void {
    activeNav.value = nextNav
  }

  function setRightPaneCollapsed(collapsed: boolean): void {
    rightPaneCollapsed.value = collapsed
  }

  return {
    activeNav,
    rightPaneCollapsed,
    setActiveNav,
    setRightPaneCollapsed
  }
})
