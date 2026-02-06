import { httpClient } from '../../shared/http/client'
import type { ApiResponse } from '../../shared/types/api'
import type { FriendDTO } from '../../shared/types/friend'

export async function fetchFriendList(): Promise<ApiResponse<FriendDTO[]>> {
  const response = await httpClient.get<ApiResponse<FriendDTO[]>>('/api/v1/auth/friend/list')
  return response.data
}
