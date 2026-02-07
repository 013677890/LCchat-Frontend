import { httpClient } from '../../shared/http/client'
import type { ApiResponse } from '../../shared/types/api'
import type {
  GetMyProfileResponseData,
  UpdateMyProfileRequest,
  UserProfileDTO
} from '../../shared/types/user'

export interface UpdateMyProfileResponseData {
  userInfo: UserProfileDTO | null
}

export interface UploadAvatarResponseData {
  avatarUrl: string
}

export interface GetMyQRCodeResponseData {
  qrCode: string
  expireAt: string
}

export interface ParseQRCodeRequest {
  token: string
}

export interface ParseQRCodeResponseData {
  uuid: string
}

export async function fetchMyProfile(): Promise<ApiResponse<GetMyProfileResponseData>> {
  const response = await httpClient.get<ApiResponse<GetMyProfileResponseData>>(
    '/api/v1/auth/user/profile'
  )
  return response.data
}

export async function updateMyProfile(
  payload: UpdateMyProfileRequest
): Promise<ApiResponse<UpdateMyProfileResponseData>> {
  const response = await httpClient.put<ApiResponse<UpdateMyProfileResponseData>>(
    '/api/v1/auth/user/profile',
    payload
  )
  return response.data
}

export async function uploadMyAvatar(file: File): Promise<ApiResponse<UploadAvatarResponseData>> {
  const formData = new FormData()
  formData.append('avatar', file)
  const response = await httpClient.post<ApiResponse<UploadAvatarResponseData>>(
    '/api/v1/auth/user/avatar',
    formData
  )
  return response.data
}

export async function fetchMyQRCode(): Promise<ApiResponse<GetMyQRCodeResponseData>> {
  const response = await httpClient.get<ApiResponse<GetMyQRCodeResponseData>>(
    '/api/v1/auth/user/qrcode'
  )
  return response.data
}

export async function parseQRCode(
  payload: ParseQRCodeRequest
): Promise<ApiResponse<ParseQRCodeResponseData>> {
  const response = await httpClient.post<ApiResponse<ParseQRCodeResponseData>>(
    '/api/v1/public/user/parse-qrcode',
    payload
  )
  return response.data
}
