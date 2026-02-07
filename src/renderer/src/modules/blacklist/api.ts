import { httpClient } from '../../shared/http/client'
import type { ApiResponse } from '../../shared/types/api'
import type { PaginationDTO } from '../../shared/types/friend'

export interface BlacklistItemDTO {
  uuid: string
  nickname: string
  avatar: string
  blacklistedAt: number
}

export interface GetBlacklistResponseData {
  items: BlacklistItemDTO[]
  pagination: PaginationDTO | null
}

export interface GetBlacklistParams {
  page?: number
  pageSize?: number
}

export interface AddBlacklistRequest {
  targetUuid: string
}

export interface RemoveBlacklistRequest {
  userUuid: string
}

export interface CheckBlacklistRequest {
  userUuid: string
  targetUuid: string
}

export interface CheckBlacklistResponseData {
  isBlacklist: boolean
}

export async function fetchBlacklist(
  params: GetBlacklistParams = {}
): Promise<ApiResponse<GetBlacklistResponseData>> {
  const response = await httpClient.get<ApiResponse<GetBlacklistResponseData>>(
    '/api/v1/auth/blacklist',
    { params }
  )
  return response.data
}

export async function addBlacklist(payload: AddBlacklistRequest): Promise<ApiResponse<null>> {
  const response = await httpClient.post<ApiResponse<null>>('/api/v1/auth/blacklist', payload)
  return response.data
}

export async function removeBlacklist(userUuid: string): Promise<ApiResponse<null>> {
  const response = await httpClient.delete<ApiResponse<null>>(
    `/api/v1/auth/blacklist/${encodeURIComponent(userUuid)}`
  )
  return response.data
}

export async function checkBlacklist(
  payload: CheckBlacklistRequest
): Promise<ApiResponse<CheckBlacklistResponseData>> {
  const response = await httpClient.post<ApiResponse<CheckBlacklistResponseData>>(
    '/api/v1/auth/blacklist/check',
    payload
  )
  return response.data
}
