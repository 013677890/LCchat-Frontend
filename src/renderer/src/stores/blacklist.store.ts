import { shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { BlacklistRow } from '../../../shared/types/localdb'
import { fetchBlacklist } from '../modules/blacklist/api'

function mapToBlacklistRow(
  userUuid: string,
  item: {
    uuid: string
    nickname: string
    avatar: string
    blacklistedAt: number
  }
): BlacklistRow {
  return {
    userUuid,
    peerUuid: item.uuid,
    payload: {
      uuid: item.uuid,
      nickname: item.nickname,
      avatar: item.avatar,
      blacklistedAt: item.blacklistedAt
    },
    updatedAt: item.blacklistedAt || Date.now()
  }
}

export const useBlacklistStore = defineStore('blacklist', () => {
  const items = shallowRef<BlacklistRow[]>([])

  function reset(): void {
    items.value = []
  }

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

  async function syncFromServer(userUuid: string): Promise<void> {
    if (!userUuid) {
      return
    }

    let page = 1
    let totalPages = 1
    const pageSize = 100
    const mergedRows: BlacklistRow[] = []

    while (page <= totalPages && page <= 50) {
      let response
      try {
        response = await fetchBlacklist({
          page,
          pageSize
        })
      } catch (error) {
        console.warn('fetch blacklist from server failed', error)
        break
      }

      const pageItems = response.data.items ?? []
      for (const item of pageItems) {
        mergedRows.push(mapToBlacklistRow(userUuid, item))
      }

      totalPages = response.data.pagination?.totalPages ?? 1
      page += 1
    }

    if (mergedRows.length > 0 || page > 1) {
      await replaceAll(userUuid, mergedRows)
      return
    }

    await load(userUuid)
  }

  return {
    items,
    reset,
    load,
    replaceAll,
    syncFromServer
  }
})
