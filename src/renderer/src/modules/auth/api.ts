import { httpClient } from '../../shared/http/client'
import type { ApiResponse } from '../../shared/types/api'

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  expiresAt: number
  userUuid: string
}

export async function login(payload: LoginRequest): Promise<ApiResponse<LoginResponse>> {
  const response = await httpClient.post<ApiResponse<LoginResponse>>('/api/v1/public/user/login', payload)
  return response.data
}
