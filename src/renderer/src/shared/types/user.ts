export interface UserProfileDTO {
  uuid?: string
  nickname?: string
  avatar?: string
  gender?: number
  signature?: string
  birthday?: string
  [key: string]: unknown
}

export interface GetMyProfileResponseData {
  userInfo: UserProfileDTO | null
}

export interface UpdateMyProfileRequest {
  nickname?: string
  gender?: number
  birthday?: string
  signature?: string
}
