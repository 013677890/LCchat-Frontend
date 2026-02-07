export interface UserProfileDTO {
  uuid?: string
  nickname?: string
  telephone?: string
  email?: string
  avatar?: string
  gender?: number
  signature?: string
  birthday?: string
  status?: number
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
