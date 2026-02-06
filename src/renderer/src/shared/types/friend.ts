import type { JsonObject } from './localdb'

export interface FriendDTO extends JsonObject {
  peerUuid?: string
  nickname?: string
  remark?: string
}
