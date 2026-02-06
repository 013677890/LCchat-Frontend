import { httpClient } from '../../shared/http/client'
import type { ApiResponse } from '../../shared/types/api'
import type { UserProfileDTO } from '../../shared/types/user'

export async function fetchMyProfile(): Promise<ApiResponse<UserProfileDTO>> {
  const response = await httpClient.get<ApiResponse<UserProfileDTO>>('/api/v1/auth/user/profile')
  return response.data
}

export async function updateMyProfile(payload: UserProfileDTO): Promise<ApiResponse<UserProfileDTO>> {
  const response = await httpClient.put<ApiResponse<UserProfileDTO>>('/api/v1/auth/user/profile', payload)
  return response.data
}
