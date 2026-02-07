import { httpClient } from '../../shared/http/client'
import type { ApiResponse } from '../../shared/types/api'

export interface LoginRequest {
  account: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  verifyCode: string
  nickname?: string
  telephone?: string
}

export interface RegisterResponseData {
  userUuid: string
  email: string
  telephone: string
  nickname: string
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

export interface LoginByCodeRequest {
  email: string
  verifyCode: string
}

export type LoginByCodeResponseData = LoginResponseData

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

export interface VerifyCodeRequest {
  email: string
  verifyCode: string
  type: VerifyCodeType
}

export interface VerifyCodeResponseData {
  valid: boolean
}

export interface ResetPasswordRequest {
  email: string
  verifyCode: string
  newPassword: string
}

export async function login(payload: LoginRequest): Promise<ApiResponse<LoginResponseData>> {
  const response = await httpClient.post<ApiResponse<LoginResponseData>>(
    '/api/v1/public/user/login',
    payload
  )
  return response.data
}

export async function register(
  payload: RegisterRequest
): Promise<ApiResponse<RegisterResponseData>> {
  const response = await httpClient.post<ApiResponse<RegisterResponseData>>(
    '/api/v1/public/user/register',
    payload
  )
  return response.data
}

export async function loginByCode(
  payload: LoginByCodeRequest
): Promise<ApiResponse<LoginByCodeResponseData>> {
  const response = await httpClient.post<ApiResponse<LoginByCodeResponseData>>(
    '/api/v1/public/user/login-by-code',
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

export async function verifyCode(
  payload: VerifyCodeRequest
): Promise<ApiResponse<VerifyCodeResponseData>> {
  const response = await httpClient.post<ApiResponse<VerifyCodeResponseData>>(
    '/api/v1/public/user/verify-code',
    payload
  )
  return response.data
}

export async function resetPassword(payload: ResetPasswordRequest): Promise<ApiResponse<null>> {
  const response = await httpClient.post<ApiResponse<null>>(
    '/api/v1/public/user/reset-password',
    payload
  )
  return response.data
}
