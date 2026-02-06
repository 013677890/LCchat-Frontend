export interface JsonObject {
  [key: string]: JsonValue
}

export type JsonValue = string | number | boolean | null | JsonObject | JsonValue[]

export interface SessionData {
  userUuid: string
  accessToken: string
  refreshToken: string
  expiresAt: number
  deviceId: string
}

export interface ProfileRow {
  userUuid: string
  payload: JsonObject
  updatedAt: number
}

export interface FriendRow {
  userUuid: string
  peerUuid: string
  payload: JsonObject
  version: number
  updatedAt: number
}

export interface FriendChangeRow {
  action: 'upsert' | 'delete'
  peerUuid: string
  payload?: JsonObject
  version: number
  updatedAt?: number
}

export interface FriendApplyRow {
  userUuid: string
  applyId: number
  direction: string
  status: number
  payload: JsonObject
  updatedAt: number
}

export interface BlacklistRow {
  userUuid: string
  peerUuid: string
  payload: JsonObject
  updatedAt: number
}

export interface ConversationRow {
  userUuid: string
  convId: string
  payload: JsonObject
  updatedAt: number
}

export interface MessageRow {
  userUuid: string
  convId: string
  msgId: string
  clientMsgId?: string
  seq?: number
  sendTime: number
  payload: JsonObject
  status: number
}
