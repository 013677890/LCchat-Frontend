import { httpClient } from '../../shared/http/client'
import type { ApiResponse } from '../../shared/types/api'

export interface GroupInfoDTO {
  groupUuid: string
  name: string
  avatar: string
  notice: string
  ownerUuid: string
  memberCount: number
  addMode: number // 0: 直接, 1: 需要审批
  muteAll: boolean
}

export interface GroupMemberItemDTO {
  userUuid: string
  role: number // 0: 普通成员, 1: 管理员
  nickname: string
  avatar: string
  groupNickname: string
  muteUntil: number // Unix 毫秒, 0 表示未禁言
}

export interface MyJoinApplicationDTO {
  applyId: string | number
  status: number
  reason: string
  reviewerUuid: string
  reviewRemark: string
  createdAt: number
  reviewedAt: number
}

export interface MyJoinApplicationItemDTO {
  applyId: string | number
  groupUuid: string
  groupName: string
  groupAvatar: string
  status: number
  reason: string
  reviewerUuid: string
  reviewRemark: string
  createdAt: number
  reviewedAt: number
}

export interface JoinRequestItemDTO {
  applyId: string | number
  applicantUuid: string
  nickname: string
  avatar: string
  reason: string
  createdAt: number
}

export interface ReviewedJoinRequestItemDTO {
  applyId: string | number
  applicantUuid: string
  nickname: string
  avatar: string
  status: number
  reason: string
  reviewerUuid: string
  reviewRemark: string
  createdAt: number
  reviewedAt: number
}

export interface CreateGroupRequest {
  name: string
  avatar?: string
  memberUuids?: string[]
}

export interface CreateGroupResponse {
  groupUuid: string
}

export interface UpdateGroupRequest {
  name?: string
  avatar?: string
  addMode?: number
}

export interface UpdateGroupNoticeRequest {
  notice: string
}

export interface ApplyJoinGroupRequest {
  reason?: string
}

export interface ApplyJoinGroupResponse {
  applyId: string | number
  joinedDirectly: boolean
}

export interface GetMyJoinApplicationResponse {
  hasApplication: boolean
  application: MyJoinApplicationDTO | null
}

export interface ListMyJoinApplicationsParams {
  page?: number
  pageSize?: number
  status?: number
}

export interface ListMyJoinApplicationsResponse {
  items: MyJoinApplicationItemDTO[]
  total: number | string
  page: number
  pageSize: number
}

export interface ListJoinRequestsParams {
  page?: number
  pageSize?: number
}

export interface ListJoinRequestsResponse {
  items: JoinRequestItemDTO[]
  total: number | string
  page: number
  pageSize: number
}

export interface GetPendingCountResponse {
  count: number | string
}

export interface ListReviewedJoinRequestsParams {
  page?: number
  pageSize?: number
  status?: number // 1: 已同意, 2: 已拒绝
}

export interface ListReviewedJoinRequestsResponse {
  items: ReviewedJoinRequestItemDTO[]
  total: number | string
  page: number
  pageSize: number
}

export interface ReviewJoinGroupRequest {
  action: number // 1: 同意, 2: 拒绝
  remark?: string
}

export interface TransferGroupOwnerRequest {
  targetUserUuid: string
}

export interface AddGroupMembersRequest {
  userUuids: string[]
}

export interface GetMemberListResponse {
  members: GroupMemberItemDTO[]
}

export interface SearchGroupsParams {
  keyword?: string
  page?: number
  pageSize?: number
}

export interface SearchGroupsResponse {
  groups: Array<{
    groupUuid: string
    name: string
    avatar: string
    memberCount: number
    addMode: number
  }>
  total: number | string
  page: number
  pageSize: number
}

export interface SearchGroupMembersParams {
  keyword?: string
  page?: number
  pageSize?: number
}

export interface SearchGroupMembersResponse {
  members: GroupMemberItemDTO[]
  total: number | string
  page: number
  pageSize: number
}

export interface UpdateGroupMemberNicknameRequest {
  groupNickname: string
}

export interface UpdateMemberRoleRequest {
  role: number // 0: 普通成员, 1: 管理员
}

export interface MuteGroupMemberRequest {
  muteUntil?: number // Unix 毫秒, 0 表示取消禁言
}

export interface UpdateGroupMuteSettingRequest {
  muteAll: boolean
}

export interface GetGroupMemberIdsResponse {
  userUuids: string[]
}

// 1. 创建群
export async function createGroup(payload: CreateGroupRequest): Promise<ApiResponse<CreateGroupResponse>> {
  const response = await httpClient.post<ApiResponse<CreateGroupResponse>>('/api/v1/auth/groups', payload)
  return response.data
}

// 2. 获取当前用户群列表
export async function fetchGroupList(): Promise<ApiResponse<{ groups: GroupInfoDTO[] }>> {
  const response = await httpClient.get<ApiResponse<{ groups: GroupInfoDTO[] }>>('/api/v1/auth/groups')
  return response.data
}

// 3. 获取群资料
export async function fetchGroupInfo(groupUuid: string): Promise<ApiResponse<GroupInfoDTO>> {
  const response = await httpClient.get<ApiResponse<GroupInfoDTO>>(`/api/v1/auth/groups/${groupUuid}`)
  return response.data
}

// 4. 更新群资料
export async function updateGroupInfo(groupUuid: string, payload: UpdateGroupRequest): Promise<ApiResponse<null>> {
  const response = await httpClient.patch<ApiResponse<null>>(`/api/v1/auth/groups/${groupUuid}`, payload)
  return response.data
}

// 5. 更新群公告
export async function updateGroupNotice(groupUuid: string, payload: UpdateGroupNoticeRequest): Promise<ApiResponse<null>> {
  const response = await httpClient.put<ApiResponse<null>>(`/api/v1/auth/groups/${groupUuid}/notice`, payload)
  return response.data
}

// 6. 申请加入群
export async function applyJoinGroup(groupUuid: string, payload: ApplyJoinGroupRequest = {}): Promise<ApiResponse<ApplyJoinGroupResponse>> {
  const response = await httpClient.post<ApiResponse<ApplyJoinGroupResponse>>(`/api/v1/auth/groups/${groupUuid}/apply`, payload)
  return response.data
}

// 7. 撤销我的入群申请
export async function cancelJoinGroupApplication(groupUuid: string): Promise<ApiResponse<null>> {
  const response = await httpClient.delete<ApiResponse<null>>(`/api/v1/auth/groups/${groupUuid}/apply`)
  return response.data
}

// 8. 查询我在指定群的最新申请
export async function fetchMyJoinGroupApplication(groupUuid: string): Promise<ApiResponse<GetMyJoinApplicationResponse>> {
  const response = await httpClient.get<ApiResponse<GetMyJoinApplicationResponse>>(`/api/v1/auth/groups/${groupUuid}/my-join-application`)
  return response.data
}

// 9. 获取我发起的入群申请列表
export async function fetchMyJoinGroupApplications(params: ListMyJoinApplicationsParams = {}): Promise<ApiResponse<ListMyJoinApplicationsResponse>> {
  const response = await httpClient.get<ApiResponse<ListMyJoinApplicationsResponse>>('/api/v1/auth/groups/join-applications', { params })
  return response.data
}

// 10. 获取待审批入群申请
export async function fetchJoinRequests(groupUuid: string, params: ListJoinRequestsParams = {}): Promise<ApiResponse<ListJoinRequestsResponse>> {
  const response = await httpClient.get<ApiResponse<ListJoinRequestsResponse>>(`/api/v1/auth/groups/${groupUuid}/join-requests`, { params })
  return response.data
}

// 11. 获取待审批数量
export async function fetchJoinRequestPendingCount(groupUuid: string): Promise<ApiResponse<GetPendingCountResponse>> {
  const response = await httpClient.get<ApiResponse<GetPendingCountResponse>>(`/api/v1/auth/groups/${groupUuid}/join-requests/pending-count`)
  return response.data
}

// 12. 获取已审批入群申请
export async function fetchReviewedJoinRequests(groupUuid: string, params: ListReviewedJoinRequestsParams = {}): Promise<ApiResponse<ListReviewedJoinRequestsResponse>> {
  const response = await httpClient.get<ApiResponse<ListReviewedJoinRequestsResponse>>(`/api/v1/auth/groups/${groupUuid}/join-requests/reviewed`, { params })
  return response.data
}

// 13. 审批入群申请
export async function reviewJoinGroup(groupUuid: string, applyId: string | number, payload: ReviewJoinGroupRequest): Promise<ApiResponse<null>> {
  const response = await httpClient.post<ApiResponse<null>>(`/api/v1/auth/groups/${groupUuid}/join-requests/${applyId}/review`, payload)
  return response.data
}

// 14. 转让群主
export async function transferGroupOwner(groupUuid: string, payload: TransferGroupOwnerRequest): Promise<ApiResponse<null>> {
  const response = await httpClient.post<ApiResponse<null>>(`/api/v1/auth/groups/${groupUuid}/transfer-owner`, payload)
  return response.data
}

// 15. 解散群
export async function dismissGroup(groupUuid: string): Promise<ApiResponse<null>> {
  const response = await httpClient.delete<ApiResponse<null>>(`/api/v1/auth/groups/${groupUuid}`)
  return response.data
}

// 16. 主动退群
export async function leaveGroup(groupUuid: string): Promise<ApiResponse<null>> {
  const response = await httpClient.post<ApiResponse<null>>(`/api/v1/auth/groups/${groupUuid}/leave`)
  return response.data
}

// 17. 添加群成员
export async function addGroupMembers(groupUuid: string, payload: AddGroupMembersRequest): Promise<ApiResponse<null>> {
  const response = await httpClient.post<ApiResponse<null>>(`/api/v1/auth/groups/${groupUuid}/members`, payload)
  return response.data
}

// 18. 获取群成员列表
export async function fetchGroupMembers(groupUuid: string): Promise<ApiResponse<GetMemberListResponse>> {
  const response = await httpClient.get<ApiResponse<GetMemberListResponse>>(`/api/v1/auth/groups/${groupUuid}/members`)
  return response.data
}

// 19. 搜索群
export async function searchGroups(params: SearchGroupsParams): Promise<ApiResponse<SearchGroupsResponse>> {
  const response = await httpClient.get<ApiResponse<SearchGroupsResponse>>('/api/v1/auth/groups/search', { params })
  return response.data
}

// 20. 搜索群成员
export async function searchGroupMembers(groupUuid: string, params: SearchGroupMembersParams): Promise<ApiResponse<SearchGroupMembersResponse>> {
  const response = await httpClient.get<ApiResponse<SearchGroupMembersResponse>>(`/api/v1/auth/groups/${groupUuid}/members/search`, { params })
  return response.data
}

// 21. 移除群成员
export async function removeGroupMember(groupUuid: string, userUuid: string): Promise<ApiResponse<null>> {
  const response = await httpClient.delete<ApiResponse<null>>(`/api/v1/auth/groups/${groupUuid}/members/${userUuid}`)
  return response.data
}

// 22. 更新我的群名片
export async function updateMyGroupNickname(groupUuid: string, payload: { groupNickname: string }): Promise<ApiResponse<null>> {
  const response = await httpClient.patch<ApiResponse<null>>(`/api/v1/auth/groups/${groupUuid}/my-nickname`, payload)
  return response.data
}

// 23. 管理员修改成员群名片
export async function updateGroupMemberNickname(groupUuid: string, userUuid: string, payload: UpdateGroupMemberNicknameRequest): Promise<ApiResponse<null>> {
  const response = await httpClient.patch<ApiResponse<null>>(`/api/v1/auth/groups/${groupUuid}/members/${userUuid}/nickname`, payload)
  return response.data
}

// 24. 设置成员角色
export async function updateMemberRole(groupUuid: string, userUuid: string, payload: UpdateMemberRoleRequest): Promise<ApiResponse<null>> {
  const response = await httpClient.patch<ApiResponse<null>>(`/api/v1/auth/groups/${groupUuid}/members/${userUuid}/role`, payload)
  return response.data
}

// 25. 设置成员禁言
export async function muteGroupMember(groupUuid: string, userUuid: string, payload: MuteGroupMemberRequest): Promise<ApiResponse<null>> {
  const response = await httpClient.patch<ApiResponse<null>>(`/api/v1/auth/groups/${groupUuid}/members/${userUuid}/mute`, payload)
  return response.data
}

// 26. 更新全员禁言
export async function updateGroupMuteSetting(groupUuid: string, payload: UpdateGroupMuteSettingRequest): Promise<ApiResponse<null>> {
  const response = await httpClient.patch<ApiResponse<null>>(`/api/v1/auth/groups/${groupUuid}/mute-setting`, payload)
  return response.data
}

// 27. 获取群成员 UUID 列表
export async function fetchGroupMemberIDs(groupUuid: string): Promise<ApiResponse<GetGroupMemberIdsResponse>> {
  const response = await httpClient.get<ApiResponse<GetGroupMemberIdsResponse>>(`/api/v1/auth/groups/${groupUuid}/member-ids`)
  return response.data
}
