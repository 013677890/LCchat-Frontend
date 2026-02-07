export interface FriendDTO {
  uuid?: string
  nickname?: string
  avatar?: string
  gender?: number
  signature?: string
  remark?: string
  groupTag?: string
  source?: string
  createdAt?: number
  [key: string]: unknown
}

export interface PaginationDTO {
  page: number
  pageSize: number
  total: number
  totalPages: number
}
