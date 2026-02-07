import { ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { FriendApplyRow, JsonObject } from '../../../shared/types/localdb'
import {
  fetchUnreadApplyCount,
  fetchFriendApplyList,
  fetchSentApplyList,
  handleFriendApply,
  markFriendApplyRead,
  sendFriendApply,
  type SentApplyItemDTO,
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

function mapSentApplyToRow(userUuid: string, item: SentApplyItemDTO): FriendApplyRow {
  return {
    userUuid,
    applyId: item.applyId,
    direction: 'outbox',
    status: item.status,
    payload: {
      applyId: item.applyId,
      targetUuid: item.targetUuid,
      targetNickname: item.targetInfo?.nickname ?? item.targetUuid,
      targetAvatar: item.targetInfo?.avatar ?? '',
      reason: item.reason,
      source: item.source,
      status: item.status,
      isRead: item.isRead,
      createdAt: item.createdAt
    },
    updatedAt: item.createdAt || Date.now()
  }
}

function isRowRead(row: FriendApplyRow): boolean {
  const value = row.payload.isRead
  return value === true || value === 1
}

function countUnreadRows(rows: FriendApplyRow[]): number {
  return rows.reduce((count, row) => count + (isRowRead(row) ? 0 : 1), 0)
}

function getString(payload: JsonObject, key: string): string {
  const value = payload[key]
  return typeof value === 'string' ? value : ''
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
  const sent = shallowRef<FriendApplyRow[]>([])
  const unreadCount = ref(0)
  const unreadCountSynced = ref(false)

  function reset(): void {
    inbox.value = []
    sent.value = []
    unreadCount.value = 0
    unreadCountSynced.value = false
  }

  async function loadInbox(userUuid: string): Promise<void> {
    if (!userUuid) {
      inbox.value = []
      unreadCount.value = 0
      unreadCountSynced.value = false
      return
    }

    try {
      inbox.value = await window.api.localdb.applies.getInbox(userUuid)
      unreadCount.value = countUnreadRows(inbox.value)
      unreadCountSynced.value = false
    } catch (error) {
      console.warn('load inbox applies from localdb failed', error)
      inbox.value = []
      unreadCount.value = 0
      unreadCountSynced.value = false
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
    unreadCount.value = countUnreadRows(inbox.value)
  }

  async function replaceInbox(userUuid: string, rows: FriendApplyRow[]): Promise<void> {
    try {
      await window.api.localdb.applies.replaceInbox(userUuid, rows)
    } catch (error) {
      console.warn('replace inbox applies in localdb failed', error)
    }

    inbox.value = [...rows].sort((a, b) => b.updatedAt - a.updatedAt)
    unreadCount.value = countUnreadRows(inbox.value)
  }

  async function loadSent(userUuid: string): Promise<void> {
    if (!userUuid) {
      sent.value = []
      return
    }

    try {
      sent.value = await window.api.localdb.applies.getSent(userUuid)
    } catch (error) {
      console.warn('load sent applies from localdb failed', error)
      sent.value = []
    }
  }

  async function upsertSent(userUuid: string, rows: FriendApplyRow[]): Promise<void> {
    try {
      await window.api.localdb.applies.upsertSent(userUuid, rows)
    } catch (error) {
      console.warn('upsert sent applies to localdb failed', error)
    }

    const rowById = new Map<number, FriendApplyRow>()
    for (const row of sent.value) {
      rowById.set(row.applyId, row)
    }
    for (const row of rows) {
      rowById.set(row.applyId, row)
    }

    sent.value = Array.from(rowById.values()).sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async function replaceSent(userUuid: string, rows: FriendApplyRow[]): Promise<void> {
    try {
      await window.api.localdb.applies.replaceSent(userUuid, rows)
    } catch (error) {
      console.warn('replace sent applies in localdb failed', error)
    }

    sent.value = [...rows].sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async function syncInboxFromServer(userUuid: string): Promise<void> {
    if (!userUuid) {
      return
    }

    let page = 1
    let totalPages = 1
    const pageSize = 100
    const allRows: FriendApplyRow[] = []
    let fetchedAnyPage = false

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

      fetchedAnyPage = true

      for (const item of response.data.items ?? []) {
        allRows.push(mapApplyToRow(userUuid, item))
      }

      totalPages = response.data.pagination?.totalPages ?? 1
      page += 1
    }

    if (fetchedAnyPage) {
      await replaceInbox(userUuid, allRows)
    } else {
      await loadInbox(userUuid)
    }

    await syncUnreadCountFromServer(userUuid)
  }

  async function syncSentFromServer(userUuid: string): Promise<void> {
    if (!userUuid) {
      return
    }

    let page = 1
    let totalPages = 1
    const pageSize = 100
    const allRows: FriendApplyRow[] = []
    let fetchedAnyPage = false

    while (page <= totalPages && page <= 50) {
      let response
      try {
        response = await fetchSentApplyList({
          status: -1,
          page,
          pageSize
        })
      } catch (error) {
        console.warn('fetch sent applies from server failed', error)
        break
      }

      fetchedAnyPage = true

      for (const item of response.data.items ?? []) {
        allRows.push(mapSentApplyToRow(userUuid, item))
      }

      totalPages = response.data.pagination?.totalPages ?? 1
      page += 1
    }

    if (fetchedAnyPage) {
      await replaceSent(userUuid, allRows)
    } else {
      await loadSent(userUuid)
    }
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

    await syncUnreadCountFromServer(userUuid)
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
    await syncUnreadCountFromServer(userUuid)
  }

  async function retrySentApply(userUuid: string, applyId: number, reason?: string): Promise<void> {
    if (!userUuid || !applyId) {
      return
    }

    const current = sent.value.find((row) => row.applyId === applyId)
    if (!current) {
      return
    }

    const targetUuid = getString(current.payload, 'targetUuid')
    if (!targetUuid) {
      return
    }

    const nextReason = reason?.trim() || getString(current.payload, 'reason')
    const response = await sendFriendApply({
      targetUuid,
      reason: nextReason || undefined,
      source: 'desktop_resend'
    })

    const timestamp = Date.now()
    const nextApplyId = response.data.applyId || current.applyId
    const nextRow: FriendApplyRow = {
      userUuid,
      applyId: nextApplyId,
      direction: 'outbox',
      status: 0,
      payload: {
        ...current.payload,
        applyId: nextApplyId,
        source: 'desktop_resend',
        reason: nextReason,
        status: 0,
        isRead: false,
        createdAt: timestamp
      },
      updatedAt: timestamp
    }

    await upsertSent(userUuid, [nextRow])
  }

  async function syncUnreadCountFromServer(userUuid: string): Promise<void> {
    if (!userUuid) {
      unreadCount.value = 0
      unreadCountSynced.value = false
      return
    }

    try {
      const response = await fetchUnreadApplyCount()
      unreadCount.value = Number(response.data.unreadCount) || 0
      unreadCountSynced.value = true
    } catch (error) {
      console.warn('fetch unread apply count failed', error)
      unreadCount.value = countUnreadRows(inbox.value)
      unreadCountSynced.value = false
    }
  }

  return {
    inbox,
    sent,
    unreadCount,
    unreadCountSynced,
    reset,
    loadInbox,
    loadSent,
    upsertInbox,
    replaceInbox,
    upsertSent,
    replaceSent,
    syncInboxFromServer,
    syncSentFromServer,
    syncUnreadCountFromServer,
    markAsRead,
    handleApplyAction,
    retrySentApply
  }
})
