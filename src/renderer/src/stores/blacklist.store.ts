import { shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { BlacklistRow } from '../../../shared/types/localdb'

export const useBlacklistStore = defineStore('blacklist', () => {
  const items = shallowRef<BlacklistRow[]>([])

  async function load(userUuid: string): Promise<void> {
    if (!userUuid) {
      items.value = []
      return
    }

    try {
      items.value = await window.api.localdb.blacklist.getList(userUuid)
    } catch (error) {
      console.warn('load blacklist from localdb failed', error)
      items.value = []
    }
  }

  async function replaceAll(userUuid: string, list: BlacklistRow[]): Promise<void> {
    try {
      await window.api.localdb.blacklist.replaceAll(userUuid, list)
    } catch (error) {
      console.warn('replace blacklist in localdb failed', error)
    }
    items.value = [...list]
  }

  return {
    items,
    load,
    replaceAll
  }
})
