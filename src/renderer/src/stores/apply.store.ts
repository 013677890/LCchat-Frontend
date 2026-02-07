import { shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { FriendApplyRow, JsonObject } from '../../../shared/types/localdb'
import {
  fetchFriendApplyList,
  handleFriendApply,
  markFriendApplyRead,
  type FriendApplyItemDTO
} from '../modules/contact/api'

function toApplyPayload(item: FriendApplyItemDTO): JsonObject {
  return {
    applyId: item.applyId,
    applicantUuid: item.applicantUuid,
    applicantNickname: item.applicantNickname,
    applicantAvatar: item.applicantAvatar,
    reason: item.reason,
    source: item.source,
    status: item.status,
    isRead: item.isRead,
    createdAt: item.createdAt
  }
}

function mapApplyToRow(userUuid: string, item: FriendApplyItemDTO): FriendApplyRow {
  return {
    userUuid,
    applyId: item.applyId,
    direction: 'inbox',
    status: item.status,
    payload: toApplyPayload(item),
    updatedAt: item.createdAt || Date.now()
  }
}

function isRowRead(row: FriendApplyRow): boolean {
  const value = row.payload.isRead
  return value === true || value === 1
}

function buildUpdatedRow(
  row: FriendApplyRow,
  patch: {
    status?: number
    isRead?: boolean
  }
): FriendApplyRow {
  const nextStatus = patch.status ?? row.status
  const nextIsRead = patch.isRead ?? isRowRead(row)

  return {
    ...row,
    status: nextStatus,
    payload: {
      ...row.payload,
      status: nextStatus,
      isRead: nextIsRead
    },
    updatedAt: Date.now()
  }
}

export const useApplyStore = defineStore('apply', () => {
  const inbox = shallowRef<FriendApplyRow[]>([])

  function reset(): void {
    inbox.value = []
  }

  async function loadInbox(userUuid: string): Promise<void> {
    if (!userUuid) {
      inbox.value = []
      return
    }

    try {
      inbox.value = await window.api.localdb.applies.getInbox(userUuid)
    } catch (error) {
      console.warn('load inbox applies from localdb failed', error)
      inbox.value = []
    }
  }

  async function upsertInbox(userUuid: string, rows: FriendApplyRow[]): Promise<void> {
    try {
      await window.api.localdb.applies.upsertInbox(userUuid, rows)
    } catch (error) {
      console.warn('upsert inbox applies to localdb failed', error)
    }

    const rowById = new Map<number, FriendApplyRow>()
    for (const row of inbox.value) {
      rowById.set(row.applyId, row)
    }
    for (const row of rows) {
      rowById.set(row.applyId, row)
    }

    inbox.value = Array.from(rowById.values()).sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async function syncInboxFromServer(userUuid: string): Promise<void> {
    if (!userUuid) {
      return
    }

    let page = 1
    let totalPages = 1
    const pageSize = 100
    const allRows: FriendApplyRow[] = []

    while (page <= totalPages && page <= 50) {
      let response
      try {
        response = await fetchFriendApplyList({
          status: -1,
          page,
          pageSize
        })
      } catch (error) {
        console.warn('fetch inbox applies from server failed', error)
        break
      }

      for (const item of response.data.items ?? []) {
        allRows.push(mapApplyToRow(userUuid, item))
      }

      totalPages = response.data.pagination?.totalPages ?? 1
      page += 1
    }

    if (allRows.length > 0) {
      await upsertInbox(userUuid, allRows)
      return
    }

    await loadInbox(userUuid)
  }

  async function markAsRead(userUuid: string, applyIds: number[]): Promise<void> {
    if (!userUuid || applyIds.length === 0) {
      return
    }

    await markFriendApplyRead({
      applyIds
    })

    const updatedRows = inbox.value
      .filter((row) => applyIds.includes(row.applyId))
      .map((row) => buildUpdatedRow(row, { isRead: true }))

    if (updatedRows.length > 0) {
      await upsertInbox(userUuid, updatedRows)
    }
  }

  async function handleApplyAction(
    userUuid: string,
    applyId: number,
    action: 1 | 2,
    remark = ''
  ): Promise<void> {
    if (!userUuid || !applyId) {
      return
    }

    await handleFriendApply({
      applyId,
      action,
      remark
    })

    const targetRow = inbox.value.find((row) => row.applyId === applyId)
    if (!targetRow) {
      return
    }

    const nextStatus = action === 1 ? 1 : 2
    const nextRow = buildUpdatedRow(targetRow, {
      status: nextStatus,
      isRead: true
    })
    await upsertInbox(userUuid, [nextRow])
  }

  return {
    inbox,
    reset,
    loadInbox,
    upsertInbox,
    syncInboxFromServer,
    markAsRead,
    handleApplyAction
  }
})
