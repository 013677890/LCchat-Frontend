import { ref } from 'vue'
import { defineStore } from 'pinia'

export type MainNavKey = 'chat' | 'contacts' | 'discover' | 'settings'

export const useAppStore = defineStore('app', () => {
  const activeNav = ref<MainNavKey>('chat')
  const rightPaneCollapsed = ref(false)

  // Persistent Notification & Sound Settings
  const soundEnabled = ref(localStorage.getItem('lcchat_sound_enabled') !== 'false')
  const toastEnabled = ref(localStorage.getItem('lcchat_toast_enabled') !== 'false')

  // Shared Sub-Tab State for Contacts programmatic redirects
  const contactActiveTab = ref<'friends' | 'applies' | 'groups' | 'blacklist'>('friends')

  function setActiveNav(nextNav: MainNavKey): void {
    activeNav.value = nextNav
  }

  function setRightPaneCollapsed(collapsed: boolean): void {
    rightPaneCollapsed.value = collapsed
  }

  function setSoundEnabled(val: boolean): void {
    soundEnabled.value = val
    localStorage.setItem('lcchat_sound_enabled', String(val))
  }

  function setToastEnabled(val: boolean): void {
    toastEnabled.value = val
    localStorage.setItem('lcchat_toast_enabled', String(val))
  }

  function setContactActiveTab(tab: 'friends' | 'applies' | 'groups' | 'blacklist'): void {
    contactActiveTab.value = tab
  }

  return {
    activeNav,
    rightPaneCollapsed,
    soundEnabled,
    toastEnabled,
    contactActiveTab,
    setActiveNav,
    setRightPaneCollapsed,
    setSoundEnabled,
    setToastEnabled,
    setContactActiveTab
  }
})

