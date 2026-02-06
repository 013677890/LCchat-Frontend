export interface ApiResponse<T> {
  code: number
  message: string
  data: T
  trace_id: string
  timestamp: number
}
