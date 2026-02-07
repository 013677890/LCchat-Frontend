import { httpClient } from '../../shared/http/client'
import type { ApiResponse } from '../../shared/types/api'

export interface DeviceRecord {
  deviceId: string
  deviceName: string
  platform: string
  appVersion: string
  isCurrentDevice: boolean
  status: number
  lastSeenAt: string
}

export interface GetDeviceListResponseData {
  devices: DeviceRecord[]
}

export interface OnlineStatusItem {
  userUuid: string
  isOnline: boolean
  lastSeenAt: string
}

export interface GetOnlineStatusResponseData {
  userUuid: string
  isOnline: boolean
  lastSeenAt: string
  onlinePlatforms: string[]
}

export interface BatchOnlineStatusRequest {
  userUuids: string[]
}

export interface BatchOnlineStatusResponseData {
  users: OnlineStatusItem[]
}

export interface ChangePasswordRequest {
  oldPassword: string
  newPassword: string
}

export interface ChangeEmailRequest {
  newEmail: string
  verifyCode: string
}

export interface ChangeEmailResponseData {
  email: string
}

export interface DeleteAccountRequest {
  password: string
  reason?: string
}

export interface DeleteAccountResponseData {
  deleteAt: string
  recoverDeadline: string
}

export async function fetchDevices(): Promise<ApiResponse<GetDeviceListResponseData>> {
  const response = await httpClient.get<ApiResponse<GetDeviceListResponseData>>(
    '/api/v1/auth/user/devices'
  )
  return response.data
}

export async function logout(deviceId: string): Promise<ApiResponse<null>> {
  const response = await httpClient.post<ApiResponse<null>>('/api/v1/auth/user/logout', {
    deviceId
  })
  return response.data
}

export async function kickDevice(deviceId: string): Promise<ApiResponse<null>> {
  const response = await httpClient.delete<ApiResponse<null>>(
    `/api/v1/auth/user/devices/${encodeURIComponent(deviceId)}`
  )
  return response.data
}

export async function fetchOnlineStatus(
  userUuid: string
): Promise<ApiResponse<GetOnlineStatusResponseData>> {
  const response = await httpClient.get<ApiResponse<GetOnlineStatusResponseData>>(
    `/api/v1/auth/user/online-status/${encodeURIComponent(userUuid)}`
  )
  return response.data
}

export async function batchFetchOnlineStatus(
  payload: BatchOnlineStatusRequest
): Promise<ApiResponse<BatchOnlineStatusResponseData>> {
  const response = await httpClient.post<ApiResponse<BatchOnlineStatusResponseData>>(
    '/api/v1/auth/user/batch-online-status',
    payload
  )
  return response.data
}

export async function changePassword(payload: ChangePasswordRequest): Promise<ApiResponse<null>> {
  const response = await httpClient.post<ApiResponse<null>>(
    '/api/v1/auth/user/change-password',
    payload
  )
  return response.data
}

export async function changeEmail(
  payload: ChangeEmailRequest
): Promise<ApiResponse<ChangeEmailResponseData>> {
  const response = await httpClient.post<ApiResponse<ChangeEmailResponseData>>(
    '/api/v1/auth/user/change-email',
    payload
  )
  return response.data
}

export async function deleteAccount(
  payload: DeleteAccountRequest
): Promise<ApiResponse<DeleteAccountResponseData>> {
  const response = await httpClient.post<ApiResponse<DeleteAccountResponseData>>(
    '/api/v1/auth/user/delete-account',
    payload
  )
  return response.data
}
