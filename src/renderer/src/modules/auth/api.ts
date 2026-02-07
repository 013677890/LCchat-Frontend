import { httpClient } from '../../shared/http/client'
import type { ApiResponse } from '../../shared/types/api'

export interface LoginRequest {
  account: string
  password: string
}

export interface LoginUserInfo {
  uuid: string
  nickname: string
  telephone: string
  email: string
  avatar: string
  gender: number
  signature: string
  birthday: string
  status: number
}

export interface LoginResponseData {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
  userInfo: LoginUserInfo | null
}

export interface RefreshTokenRequest {
  uuid: string
  device_id: string
  refreshToken: string
}

export interface RefreshTokenResponseData {
  accessToken: string
  tokenType: string
  expiresIn: number
}

export type VerifyCodeType = 1 | 2 | 3 | 4

export interface SendVerifyCodeRequest {
  email: string
  type: VerifyCodeType
}

export interface SendVerifyCodeResponseData {
  expireSeconds: number
}

export async function login(payload: LoginRequest): Promise<ApiResponse<LoginResponseData>> {
  const response = await httpClient.post<ApiResponse<LoginResponseData>>(
    '/api/v1/public/user/login',
    payload
  )
  return response.data
}

export async function refreshToken(
  payload: RefreshTokenRequest
): Promise<ApiResponse<RefreshTokenResponseData>> {
  const response = await httpClient.post<ApiResponse<RefreshTokenResponseData>>(
    '/api/v1/public/user/refresh-token',
    payload
  )
  return response.data
}

export async function sendVerifyCode(
  payload: SendVerifyCodeRequest
): Promise<ApiResponse<SendVerifyCodeResponseData>> {
  const response = await httpClient.post<ApiResponse<SendVerifyCodeResponseData>>(
    '/api/v1/public/user/send-verify-code',
    payload
  )
  return response.data
}
