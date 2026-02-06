import type { JsonObject } from './localdb'

export interface UserProfileDTO extends JsonObject {
  userUuid?: string
  nickname?: string
  avatar?: string
  bio?: string
}
