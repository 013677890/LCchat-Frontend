export interface UserProfileDTO {
  userUuid?: string
  nickname?: string
  avatar?: string
  bio?: string
  [key: string]: unknown
}
