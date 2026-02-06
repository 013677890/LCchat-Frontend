import { type IpcMain } from 'electron'
import { getLocalDB, initLocalDB } from '../db/sqlite'
import { IPC_CHANNELS } from './channels'
import type {
  BlacklistRow,
  ConversationRow,
  FriendApplyRow,
  FriendChangeRow,
  FriendRow,
  JsonObject,
  MessageRow,
  ProfileRow
} from '../../shared/types/localdb'

type PayloadRow = {
  payload_json: string
  updated_at: number
}

function bind(
  ipcMain: IpcMain,
  channel: string,
  listener: (...args: unknown[]) => Promise<unknown> | unknown
): void {
  ipcMain.removeHandler(channel)
  ipcMain.handle(channel, (_, ...args) => listener(...args))
}

function now(): number {
  return Date.now()
}

function serializePayload(payload: JsonObject | undefined): string {
  return JSON.stringify(payload ?? {})
}

function parsePayload(payloadJson: string): JsonObject {
  try {
    const parsed = JSON.parse(payloadJson) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as JsonObject
    }
    return {}
  } catch {
    return {}
  }
}

function normalizeLimit(limit?: number): number {
  if (!Number.isFinite(limit)) {
    return 30
  }

  return Math.min(100, Math.max(1, Math.trunc(limit as number)))
}

function normalizeCursor(cursor?: number): number | null {
  if (!Number.isFinite(cursor)) {
    return null
  }

  const nextCursor = Math.trunc(cursor as number)
  return nextCursor > 0 ? nextCursor : null
}

function upsertSyncState(userUuid: string, domain: string, lastVersion: number): void {
  const db = getLocalDB()
  db.prepare(
    `INSERT INTO sync_state(user_uuid, domain, last_version, updated_at)
     VALUES(@user_uuid, @domain, @last_version, @updated_at)
     ON CONFLICT(user_uuid, domain) DO UPDATE SET
       last_version = excluded.last_version,
       updated_at = excluded.updated_at`
  ).run({
    user_uuid: userUuid,
    domain,
    last_version: lastVersion,
    updated_at: now()
  })
}

export function registerLocalDBHandlers(ipcMain: IpcMain): void {
  bind(ipcMain, IPC_CHANNELS.localdb.init, () => {
    initLocalDB()
  })

  bind(ipcMain, IPC_CHANNELS.localdb.profile.get, (userUuid: string): ProfileRow | null => {
    const db = getLocalDB()
    const row = db
      .prepare(`SELECT payload_json, updated_at FROM profiles WHERE user_uuid = ?`)
      .get(userUuid) as PayloadRow | undefined

    if (!row) {
      return null
    }

    return {
      userUuid,
      payload: parsePayload(row.payload_json),
      updatedAt: row.updated_at
    }
  })

  bind(ipcMain, IPC_CHANNELS.localdb.profile.upsert, (profile: ProfileRow) => {
    const db = getLocalDB()
    db.prepare(
      `INSERT INTO profiles(user_uuid, payload_json, updated_at)
       VALUES(@user_uuid, @payload_json, @updated_at)
       ON CONFLICT(user_uuid) DO UPDATE SET
         payload_json = excluded.payload_json,
         updated_at = excluded.updated_at`
    ).run({
      user_uuid: profile.userUuid,
      payload_json: serializePayload(profile.payload),
      updated_at: profile.updatedAt || now()
    })
  })

  bind(ipcMain, IPC_CHANNELS.localdb.friends.getList, (userUuid: string): FriendRow[] => {
    const db = getLocalDB()
    const rows = db
      .prepare(
        `SELECT peer_uuid, payload_json, version, updated_at
         FROM friends
         WHERE user_uuid = ?
         ORDER BY updated_at DESC`
      )
      .all(userUuid) as Array<{
      peer_uuid: string
      payload_json: string
      version: number
      updated_at: number
    }>

    return rows.map((row) => ({
      userUuid,
      peerUuid: row.peer_uuid,
      payload: parsePayload(row.payload_json),
      version: row.version,
      updatedAt: row.updated_at
    }))
  })

  bind(
    ipcMain,
    IPC_CHANNELS.localdb.friends.replaceAll,
    (userUuid: string, items: FriendRow[], version: number) => {
      const db = getLocalDB()
      const replaceAll = db.transaction((rows: FriendRow[]) => {
        db.prepare(`DELETE FROM friends WHERE user_uuid = ?`).run(userUuid)
        const stmt = db.prepare(
          `INSERT INTO friends(user_uuid, peer_uuid, payload_json, version, updated_at)
           VALUES(@user_uuid, @peer_uuid, @payload_json, @version, @updated_at)`
        )

        for (const item of rows) {
          stmt.run({
            user_uuid: userUuid,
            peer_uuid: item.peerUuid,
            payload_json: serializePayload(item.payload),
            version: item.version || version,
            updated_at: item.updatedAt || now()
          })
        }
      })

      replaceAll(items)
      upsertSyncState(userUuid, 'friend', version)
    }
  )

  bind(
    ipcMain,
    IPC_CHANNELS.localdb.friends.applyChanges,
    (userUuid: string, changes: FriendChangeRow[], latestVersion: number) => {
      const db = getLocalDB()
      const applyChanges = db.transaction((inputChanges: FriendChangeRow[]) => {
        const deleteStmt = db.prepare(`DELETE FROM friends WHERE user_uuid = ? AND peer_uuid = ?`)
        const upsertStmt = db.prepare(
          `INSERT INTO friends(user_uuid, peer_uuid, payload_json, version, updated_at)
           VALUES(@user_uuid, @peer_uuid, @payload_json, @version, @updated_at)
           ON CONFLICT(user_uuid, peer_uuid) DO UPDATE SET
             payload_json = excluded.payload_json,
             version = excluded.version,
             updated_at = excluded.updated_at`
        )

        for (const change of inputChanges) {
          if (change.action === 'delete') {
            deleteStmt.run(userUuid, change.peerUuid)
            continue
          }

          upsertStmt.run({
            user_uuid: userUuid,
            peer_uuid: change.peerUuid,
            payload_json: serializePayload(change.payload),
            version: change.version || latestVersion,
            updated_at: change.updatedAt || now()
          })
        }
      })

      applyChanges(changes)
      upsertSyncState(userUuid, 'friend', latestVersion)
    }
  )

  bind(ipcMain, IPC_CHANNELS.localdb.applies.getInbox, (userUuid: string): FriendApplyRow[] => {
    const db = getLocalDB()
    const rows = db
      .prepare(
        `SELECT apply_id, direction, status, payload_json, updated_at
         FROM friend_applies
         WHERE user_uuid = ? AND direction = 'inbox'
         ORDER BY updated_at DESC`
      )
      .all(userUuid) as Array<{
      apply_id: number
      direction: string
      status: number
      payload_json: string
      updated_at: number
    }>

    return rows.map((row) => ({
      userUuid,
      applyId: row.apply_id,
      direction: row.direction,
      status: row.status,
      payload: parsePayload(row.payload_json),
      updatedAt: row.updated_at
    }))
  })

  bind(
    ipcMain,
    IPC_CHANNELS.localdb.applies.upsertInbox,
    (userUuid: string, items: FriendApplyRow[]) => {
      const db = getLocalDB()
      const upsertInbox = db.transaction((rows: FriendApplyRow[]) => {
        const stmt = db.prepare(
          `INSERT INTO friend_applies(user_uuid, apply_id, direction, status, payload_json, updated_at)
           VALUES(@user_uuid, @apply_id, @direction, @status, @payload_json, @updated_at)
           ON CONFLICT(user_uuid, apply_id, direction) DO UPDATE SET
             status = excluded.status,
             payload_json = excluded.payload_json,
             updated_at = excluded.updated_at`
        )

        for (const item of rows) {
          stmt.run({
            user_uuid: userUuid,
            apply_id: item.applyId,
            direction: item.direction || 'inbox',
            status: item.status,
            payload_json: serializePayload(item.payload),
            updated_at: item.updatedAt || now()
          })
        }
      })

      upsertInbox(items)
    }
  )

  bind(ipcMain, IPC_CHANNELS.localdb.blacklist.getList, (userUuid: string): BlacklistRow[] => {
    const db = getLocalDB()
    const rows = db
      .prepare(
        `SELECT peer_uuid, payload_json, updated_at
         FROM blacklist
         WHERE user_uuid = ?
         ORDER BY updated_at DESC`
      )
      .all(userUuid) as Array<{
      peer_uuid: string
      payload_json: string
      updated_at: number
    }>

    return rows.map((row) => ({
      userUuid,
      peerUuid: row.peer_uuid,
      payload: parsePayload(row.payload_json),
      updatedAt: row.updated_at
    }))
  })

  bind(
    ipcMain,
    IPC_CHANNELS.localdb.blacklist.replaceAll,
    (userUuid: string, items: BlacklistRow[]) => {
      const db = getLocalDB()
      const replaceAll = db.transaction((rows: BlacklistRow[]) => {
        db.prepare(`DELETE FROM blacklist WHERE user_uuid = ?`).run(userUuid)
        const stmt = db.prepare(
          `INSERT INTO blacklist(user_uuid, peer_uuid, payload_json, updated_at)
           VALUES(@user_uuid, @peer_uuid, @payload_json, @updated_at)`
        )

        for (const item of rows) {
          stmt.run({
            user_uuid: userUuid,
            peer_uuid: item.peerUuid,
            payload_json: serializePayload(item.payload),
            updated_at: item.updatedAt || now()
          })
        }
      })

      replaceAll(items)
    }
  )

  bind(
    ipcMain,
    IPC_CHANNELS.localdb.chat.getConversations,
    (userUuid: string): ConversationRow[] => {
      const db = getLocalDB()
      const rows = db
        .prepare(
          `SELECT conv_id, payload_json, updated_at
           FROM conversations
           WHERE user_uuid = ?
           ORDER BY updated_at DESC`
        )
        .all(userUuid) as Array<{
        conv_id: string
        payload_json: string
        updated_at: number
      }>

      return rows.map((row) => ({
        userUuid,
        convId: row.conv_id,
        payload: parsePayload(row.payload_json),
        updatedAt: row.updated_at
      }))
    }
  )

  bind(
    ipcMain,
    IPC_CHANNELS.localdb.chat.upsertConversations,
    (userUuid: string, items: ConversationRow[]) => {
      const db = getLocalDB()
      const upsertConversations = db.transaction((rows: ConversationRow[]) => {
        const stmt = db.prepare(
          `INSERT INTO conversations(user_uuid, conv_id, payload_json, updated_at)
           VALUES(@user_uuid, @conv_id, @payload_json, @updated_at)
           ON CONFLICT(user_uuid, conv_id) DO UPDATE SET
             payload_json = excluded.payload_json,
             updated_at = excluded.updated_at`
        )

        for (const item of rows) {
          stmt.run({
            user_uuid: userUuid,
            conv_id: item.convId,
            payload_json: serializePayload(item.payload),
            updated_at: item.updatedAt || now()
          })
        }
      })

      upsertConversations(items)
    }
  )

  bind(
    ipcMain,
    IPC_CHANNELS.localdb.chat.getMessages,
    (userUuid: string, convId: string, cursor?: number, limit?: number): MessageRow[] => {
      const db = getLocalDB()
      const queryLimit = normalizeLimit(limit)
      const queryCursor = normalizeCursor(cursor)

      const rows =
        queryCursor === null
          ? (db
              .prepare(
                `SELECT msg_id, client_msg_id, seq, send_time, payload_json, status
                 FROM messages
                 WHERE user_uuid = ? AND conv_id = ?
                 ORDER BY send_time DESC
                 LIMIT ?`
              )
              .all(userUuid, convId, queryLimit) as Array<{
              msg_id: string
              client_msg_id: string | null
              seq: number | null
              send_time: number
              payload_json: string
              status: number
            }>)
          : (db
              .prepare(
                `SELECT msg_id, client_msg_id, seq, send_time, payload_json, status
                 FROM messages
                 WHERE user_uuid = ? AND conv_id = ? AND send_time < ?
                 ORDER BY send_time DESC
                 LIMIT ?`
              )
              .all(userUuid, convId, queryCursor, queryLimit) as Array<{
              msg_id: string
              client_msg_id: string | null
              seq: number | null
              send_time: number
              payload_json: string
              status: number
            }>)

      return rows
        .map((row) => ({
          userUuid,
          convId,
          msgId: row.msg_id,
          clientMsgId: row.client_msg_id ?? undefined,
          seq: row.seq ?? undefined,
          sendTime: row.send_time,
          payload: parsePayload(row.payload_json),
          status: row.status
        }))
        .reverse()
    }
  )

  bind(
    ipcMain,
    IPC_CHANNELS.localdb.chat.upsertMessages,
    (userUuid: string, convId: string, items: MessageRow[]) => {
      const db = getLocalDB()
      const upsertMessages = db.transaction((rows: MessageRow[]) => {
        const stmt = db.prepare(
          `INSERT INTO messages(
             user_uuid,
             conv_id,
             msg_id,
             client_msg_id,
             seq,
             send_time,
             payload_json,
             status
           ) VALUES(
             @user_uuid,
             @conv_id,
             @msg_id,
             @client_msg_id,
             @seq,
             @send_time,
             @payload_json,
             @status
           )
           ON CONFLICT(user_uuid, conv_id, msg_id) DO UPDATE SET
             client_msg_id = excluded.client_msg_id,
             seq = excluded.seq,
             send_time = excluded.send_time,
             payload_json = excluded.payload_json,
             status = excluded.status`
        )

        for (const item of rows) {
          stmt.run({
            user_uuid: userUuid,
            conv_id: convId,
            msg_id: item.msgId,
            client_msg_id: item.clientMsgId ?? null,
            seq: item.seq ?? null,
            send_time: item.sendTime,
            payload_json: serializePayload(item.payload),
            status: item.status
          })
        }
      })

      upsertMessages(items)
    }
  )

  bind(ipcMain, IPC_CHANNELS.localdb.chat.saveDraft, (userUuid: string, convId: string, draft: string) => {
    const db = getLocalDB()
    db.prepare(
      `INSERT INTO message_drafts(user_uuid, conv_id, draft_text, updated_at)
       VALUES(@user_uuid, @conv_id, @draft_text, @updated_at)
       ON CONFLICT(user_uuid, conv_id) DO UPDATE SET
         draft_text = excluded.draft_text,
         updated_at = excluded.updated_at`
    ).run({
      user_uuid: userUuid,
      conv_id: convId,
      draft_text: draft,
      updated_at: now()
    })
  })

  bind(ipcMain, IPC_CHANNELS.localdb.chat.getDraft, (userUuid: string, convId: string): string => {
    const db = getLocalDB()
    const row = db
      .prepare(`SELECT draft_text FROM message_drafts WHERE user_uuid = ? AND conv_id = ?`)
      .get(userUuid, convId) as { draft_text: string } | undefined

    return row?.draft_text ?? ''
  })
}
