import { httpClient } from '../../shared/http/client'
import type { ApiResponse } from '../../shared/types/api'

export interface DeviceRecord {
  deviceId: string
  platform: string
  ip: string
  lastActiveAt: number
}

export async function fetchDevices(): Promise<ApiResponse<DeviceRecord[]>> {
  const response = await httpClient.get<ApiResponse<DeviceRecord[]>>('/api/v1/auth/user/devices')
  return response.data
}

export async function logout(deviceId: string): Promise<ApiResponse<null>> {
  const response = await httpClient.post<ApiResponse<null>>('/api/v1/auth/user/logout', {
    deviceId
  })
  return response.data
}
