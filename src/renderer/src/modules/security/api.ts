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
