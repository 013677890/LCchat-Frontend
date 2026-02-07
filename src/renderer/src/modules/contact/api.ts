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

export interface HandleFriendApplyRequest {
  applyId: number
  action: 1 | 2
  remark?: string
}

export interface MarkFriendApplyReadRequest {
  applyIds: number[]
}

export interface DeleteFriendRequest {
  userUuid: string
}

export interface SetFriendRemarkRequest {
  userUuid: string
  remark: string
}

export interface SetFriendTagRequest {
  userUuid: string
  groupTag: string
}

export interface SearchUserParams {
  keyword: string
  page?: number
  pageSize?: number
}

export interface SearchUserItemDTO {
  uuid: string
  nickname: string
  avatar: string
  signature: string
  isFriend: boolean
}

export interface SearchUserResponseData {
  items: SearchUserItemDTO[]
  pagination: PaginationDTO | null
}

export interface SendFriendApplyRequest {
  targetUuid: string
  reason?: string
  source?: string
}

export interface SendFriendApplyResponseData {
  applyId: number
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

export async function handleFriendApply(
  payload: HandleFriendApplyRequest
): Promise<ApiResponse<null>> {
  const response = await httpClient.post<ApiResponse<null>>(
    '/api/v1/auth/friend/apply/handle',
    payload
  )
  return response.data
}

export async function markFriendApplyRead(
  payload: MarkFriendApplyReadRequest
): Promise<ApiResponse<null>> {
  const response = await httpClient.post<ApiResponse<null>>(
    '/api/v1/auth/friend/apply/read',
    payload
  )
  return response.data
}

export async function deleteFriend(payload: DeleteFriendRequest): Promise<ApiResponse<null>> {
  const response = await httpClient.post<ApiResponse<null>>('/api/v1/auth/friend/delete', payload)
  return response.data
}

export async function setFriendRemark(payload: SetFriendRemarkRequest): Promise<ApiResponse<null>> {
  const response = await httpClient.post<ApiResponse<null>>('/api/v1/auth/friend/remark', payload)
  return response.data
}

export async function setFriendTag(payload: SetFriendTagRequest): Promise<ApiResponse<null>> {
  const response = await httpClient.post<ApiResponse<null>>('/api/v1/auth/friend/tag', payload)
  return response.data
}

export async function searchUsers(
  params: SearchUserParams
): Promise<ApiResponse<SearchUserResponseData>> {
  const response = await httpClient.get<ApiResponse<SearchUserResponseData>>(
    '/api/v1/auth/user/search',
    {
      params
    }
  )
  return response.data
}

export async function sendFriendApply(
  payload: SendFriendApplyRequest
): Promise<ApiResponse<SendFriendApplyResponseData>> {
  const response = await httpClient.post<ApiResponse<SendFriendApplyResponseData>>(
    '/api/v1/auth/friend/apply',
    payload
  )
  return response.data
}
