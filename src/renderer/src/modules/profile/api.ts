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
