import axios from 'axios'
import type { SessionData } from '../../../../shared/types/localdb'
import type { ApiResponse } from '../types/api'

interface RefreshTokenResponseData {
  accessToken: string
  tokenType: string
  expiresIn: number
}

const refreshClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080',
  timeout: 10_000
})

export async function refreshSessionToken(): Promise<SessionData | null> {
  const currentSession = await window.api.session.get()
  if (!currentSession?.refreshToken || !currentSession.userUuid) {
    return null
  }

  const response = await refreshClient.post<ApiResponse<RefreshTokenResponseData>>(
    '/api/v1/public/user/refresh-token',
    {
      uuid: currentSession.userUuid,
      device_id: currentSession.deviceId,
      refreshToken: currentSession.refreshToken
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Device-ID': currentSession.deviceId
      }
    }
  )

  const payload = response.data
  if (payload.code !== 0 || !payload.data?.accessToken) {
    throw new Error(payload.message || '刷新登录态失败')
  }

  const nextSession: SessionData = {
    ...currentSession,
    accessToken: payload.data.accessToken,
    expiresAt: Date.now() + Math.max(0, payload.data.expiresIn) * 1000
  }

  await window.api.session.set(nextSession)
  return nextSession
}
