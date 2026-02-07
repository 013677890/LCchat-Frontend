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

export async function fetchBlacklist(
  params: GetBlacklistParams = {}
): Promise<ApiResponse<GetBlacklistResponseData>> {
  const response = await httpClient.get<ApiResponse<GetBlacklistResponseData>>(
    '/api/v1/auth/blacklist',
    { params }
  )
  return response.data
}
