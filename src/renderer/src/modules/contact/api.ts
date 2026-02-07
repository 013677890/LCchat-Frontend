import { httpClient } from '../../shared/http/client'
import type { ApiResponse } from '../../shared/types/api'
import type { FriendDTO, PaginationDTO } from '../../shared/types/friend'

export interface GetFriendListResponseData {
  items: FriendDTO[]
  pagination: PaginationDTO | null
  version: number
}

export interface SyncFriendChangeDTO extends FriendDTO {
  changeType: 'add' | 'update' | 'delete'
  changedAt: number
}

export interface SyncFriendListResponseData {
  changes: SyncFriendChangeDTO[]
  hasMore: boolean
  latestVersion: number
}

export interface GetFriendListParams {
  page?: number
  pageSize?: number
  groupTag?: string
}

export interface SyncFriendListRequest {
  version: number
  limit?: number
}

export interface FriendApplyItemDTO {
  applyId: number
  applicantUuid: string
  applicantNickname: string
  applicantAvatar: string
  reason: string
  source: string
  status: number
  isRead: boolean
  createdAt: number
}

export interface FriendApplyListResponseData {
  items: FriendApplyItemDTO[]
  pagination: PaginationDTO | null
}

export interface GetFriendApplyListParams {
  status?: -1 | 0 | 1 | 2
  page?: number
  pageSize?: number
}

export async function fetchFriendList(
  params: GetFriendListParams = {}
): Promise<ApiResponse<GetFriendListResponseData>> {
  const response = await httpClient.get<ApiResponse<GetFriendListResponseData>>(
    '/api/v1/auth/friend/list',
    { params }
  )
  return response.data
}

export async function syncFriendList(
  payload: SyncFriendListRequest
): Promise<ApiResponse<SyncFriendListResponseData>> {
  const response = await httpClient.post<ApiResponse<SyncFriendListResponseData>>(
    '/api/v1/auth/friend/sync',
    payload
  )
  return response.data
}

export async function fetchFriendApplyList(
  params: GetFriendApplyListParams = {}
): Promise<ApiResponse<FriendApplyListResponseData>> {
  const response = await httpClient.get<ApiResponse<FriendApplyListResponseData>>(
    '/api/v1/auth/friend/apply-list',
    { params }
  )
  return response.data
}
