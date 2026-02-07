import { shallowRef } from 'vue'
import { defineStore } from 'pinia'
import {
  batchFetchOnlineStatus,
  fetchOnlineStatus,
  type GetOnlineStatusResponseData,
  type OnlineStatusItem
} from '../modules/security/api'

export interface PresenceStatus {
  userUuid: string
  isOnline: boolean
  lastSeenAt: string
  onlinePlatforms: string[]
}

function normalizeUuidList(userUuids: string[]): string[] {
  return [...new Set(userUuids.map((item) => item.trim()).filter(Boolean))]
}

function toPresenceStatus(item: OnlineStatusItem | GetOnlineStatusResponseData): PresenceStatus {
  return {
    userUuid: item.userUuid,
    isOnline: Boolean(item.isOnline),
    lastSeenAt: item.lastSeenAt || '',
    onlinePlatforms:
      'onlinePlatforms' in item && Array.isArray(item.onlinePlatforms) ? item.onlinePlatforms : []
  }
}

function splitChunks<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize))
  }
  return chunks
}

export const usePresenceStore = defineStore('presence', () => {
  const statusByUserUuid = shallowRef<Record<string, PresenceStatus>>({})

  function reset(): void {
    statusByUserUuid.value = {}
  }

  function getStatus(userUuid: string): PresenceStatus | null {
    const normalized = userUuid.trim()
    if (!normalized) {
      return null
    }
    return statusByUserUuid.value[normalized] ?? null
  }

  function upsertStatuses(items: PresenceStatus[]): void {
    if (items.length === 0) {
      return
    }

    const nextMap = { ...statusByUserUuid.value }
    for (const item of items) {
      nextMap[item.userUuid] = item
    }
    statusByUserUuid.value = nextMap
  }

  async function syncSingle(userUuid: string): Promise<void> {
    const normalized = userUuid.trim()
    if (!normalized) {
      return
    }

    try {
      const response = await fetchOnlineStatus(normalized)
      upsertStatuses([toPresenceStatus(response.data)])
    } catch (error) {
      console.warn('fetch single online status failed', error)
    }
  }

  async function syncBatch(userUuids: string[]): Promise<void> {
    const normalized = normalizeUuidList(userUuids)
    if (normalized.length === 0) {
      return
    }

    const chunks = splitChunks(normalized, 100)
    for (const chunk of chunks) {
      try {
        const response = await batchFetchOnlineStatus({
          userUuids: chunk
        })
        const statuses = (response.data.users ?? []).map(toPresenceStatus)
        upsertStatuses(statuses)
      } catch (error) {
        console.warn('fetch batch online status failed', error)
      }
    }
  }

  return {
    statusByUserUuid,
    reset,
    getStatus,
    syncSingle,
    syncBatch
  }
})
