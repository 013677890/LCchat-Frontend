import { ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { FriendChangeRow, FriendRow, JsonObject } from '../../../shared/types/localdb'
import {
  deleteFriend,
  fetchFriendList,
  setFriendRemark,
  setFriendTag,
  syncFriendList,
  type SyncFriendChangeDTO
} from '../modules/contact/api'
import type { FriendDTO } from '../shared/types/friend'

interface FriendTagSuggestion {
  tagName: string
  count: number
}

function buildFriendPayload(item: FriendDTO): JsonObject {
  return {
    uuid: item.uuid ?? '',
    nickname: item.nickname ?? '',
    avatar: item.avatar ?? '',
    gender: typeof item.gender === 'number' ? item.gender : 0,
    signature: item.signature ?? '',
    remark: item.remark ?? '',
    groupTag: item.groupTag ?? '',
    source: item.source ?? '',
    createdAt: typeof item.createdAt === 'number' ? item.createdAt : 0
  }
}

function mapFriendDTOToRow(userUuid: string, item: FriendDTO, version: number): FriendRow {
  const peerUuid = typeof item.uuid === 'string' ? item.uuid : ''
  return {
    userUuid,
    peerUuid,
    payload: buildFriendPayload(item),
    version,
    updatedAt: Date.now()
  }
}

function mapSyncChangeToRow(change: SyncFriendChangeDTO): FriendChangeRow {
  const peerUuid = typeof change.uuid === 'string' ? change.uuid : ''
  const action = change.changeType === 'delete' ? 'delete' : 'upsert'

  if (action === 'delete') {
    return {
      action,
      peerUuid,
      version: 0,
      updatedAt: Date.now()
    }
  }

  return {
    action,
    peerUuid,
    payload: buildFriendPayload(change),
    version: 0,
    updatedAt: typeof change.changedAt === 'number' ? change.changedAt : Date.now()
  }
}

function getLocalVersion(items: FriendRow[]): number {
  return items.reduce((maxVersion, item) => Math.max(maxVersion, item.version || 0), 0)
}

function buildTagSuggestions(rows: FriendRow[]): FriendTagSuggestion[] {
  const counter = new Map<string, number>()

  for (const row of rows) {
    const groupTag = typeof row.payload.groupTag === 'string' ? row.payload.groupTag.trim() : ''
    if (!groupTag) {
      continue
    }
    counter.set(groupTag, (counter.get(groupTag) ?? 0) + 1)
  }

  return [...counter.entries()]
    .map(([tagName, count]) => ({ tagName, count }))
    .sort((a, b) => b.count - a.count || a.tagName.localeCompare(b.tagName, 'zh-CN'))
}

export const useFriendStore = defineStore('friend', () => {
  const friends = shallowRef<FriendRow[]>([])
  const tagSuggestions = shallowRef<FriendTagSuggestion[]>([])
  const version = ref(0)

  function reset(): void {
    friends.value = []
    tagSuggestions.value = []
    version.value = 0
  }

  async function loadFriends(userUuid: string): Promise<void> {
    if (!userUuid) {
      friends.value = []
      return
    }

    try {
      friends.value = await window.api.localdb.friends.getList(userUuid)
      tagSuggestions.value = buildTagSuggestions(friends.value)
      version.value = getLocalVersion(friends.value)
    } catch (error) {
      console.warn('load friends from localdb failed', error)
      friends.value = []
      tagSuggestions.value = []
      version.value = 0
    }
  }

  async function replaceAll(
    userUuid: string,
    items: FriendRow[],
    latestVersion: number
  ): Promise<void> {
    try {
      await window.api.localdb.friends.replaceAll(userUuid, items, latestVersion)
    } catch (error) {
      console.warn('replace friends in localdb failed', error)
    }
    friends.value = [...items]
    tagSuggestions.value = buildTagSuggestions(items)
    version.value = latestVersion
  }

  async function applyChanges(
    userUuid: string,
    changes: FriendChangeRow[],
    latestVersion: number
  ): Promise<void> {
    try {
      await window.api.localdb.friends.applyChanges(userUuid, changes, latestVersion)
    } catch (error) {
      console.warn('apply friend changes in localdb failed', error)
    }
    await loadFriends(userUuid)
    version.value = latestVersion
  }

  async function pullFullListFromServer(userUuid: string): Promise<void> {
    const pageSize = 100
    let page = 1
    let totalPages = 1
    let latestVersion = 0
    const mergedRows: FriendRow[] = []

    while (page <= totalPages && page <= 50) {
      const response = await fetchFriendList({
        page,
        pageSize
      })

      latestVersion = response.data.version || latestVersion
      const items = response.data.items ?? []
      for (const item of items) {
        mergedRows.push(mapFriendDTOToRow(userUuid, item, latestVersion))
      }

      totalPages = response.data.pagination?.totalPages ?? 1
      page += 1
    }

    await replaceAll(userUuid, mergedRows, latestVersion)
  }

  async function syncFromServer(userUuid: string): Promise<void> {
    if (!userUuid) {
      return
    }

    await loadFriends(userUuid)

    try {
      await pullFullListFromServer(userUuid)
    } catch (error) {
      console.warn('pull full friend list failed, keep local cache', error)
    }

    let cursorVersion = version.value
    let hasMore = true
    let rounds = 0

    while (hasMore && rounds < 20) {
      rounds += 1

      let syncResponse
      try {
        syncResponse = await syncFriendList({
          version: cursorVersion,
          limit: 200
        })
      } catch (error) {
        console.warn('friend sync failed', error)
        break
      }

      const changes = (syncResponse.data.changes ?? []).map(mapSyncChangeToRow)
      const latestVersion = syncResponse.data.latestVersion || cursorVersion
      if (changes.length > 0 || latestVersion !== cursorVersion) {
        await applyChanges(userUuid, changes, latestVersion)
      }

      cursorVersion = latestVersion
      hasMore = Boolean(syncResponse.data.hasMore)
    }
  }

  async function removeFriend(userUuid: string, peerUuid: string): Promise<void> {
    if (!userUuid || !peerUuid) {
      return
    }

    await deleteFriend({
      userUuid: peerUuid
    })

    const nextRows = friends.value.filter((item) => item.peerUuid !== peerUuid)
    await replaceAll(userUuid, nextRows, version.value)
    await syncFromServer(userUuid)
  }

  async function updateFriendRemark(
    userUuid: string,
    peerUuid: string,
    remark: string
  ): Promise<void> {
    if (!userUuid || !peerUuid) {
      return
    }

    await setFriendRemark({
      userUuid: peerUuid,
      remark
    })

    const current = friends.value.find((item) => item.peerUuid === peerUuid)
    if (!current) {
      await syncFromServer(userUuid)
      return
    }

    await applyChanges(
      userUuid,
      [
        {
          action: 'upsert',
          peerUuid,
          payload: {
            ...current.payload,
            remark
          },
          version: current.version,
          updatedAt: Date.now()
        }
      ],
      version.value
    )
    await syncFromServer(userUuid)
  }

  async function updateFriendTag(
    userUuid: string,
    peerUuid: string,
    groupTag: string
  ): Promise<void> {
    if (!userUuid || !peerUuid) {
      return
    }

    await setFriendTag({
      userUuid: peerUuid,
      groupTag
    })

    const current = friends.value.find((item) => item.peerUuid === peerUuid)
    if (!current) {
      await syncFromServer(userUuid)
      return
    }

    await applyChanges(
      userUuid,
      [
        {
          action: 'upsert',
          peerUuid,
          payload: {
            ...current.payload,
            groupTag
          },
          version: current.version,
          updatedAt: Date.now()
        }
      ],
      version.value
    )
    await syncFromServer(userUuid)
  }

  return {
    friends,
    tagSuggestions,
    version,
    reset,
    loadFriends,
    replaceAll,
    applyChanges,
    syncFromServer,
    removeFriend,
    updateFriendRemark,
    updateFriendTag
  }
})
