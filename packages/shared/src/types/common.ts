/** 通用 API 响应包装 */
export interface ApiResponse<T> {
  data: T
  message?: string
}

/** 分页请求参数 */
export interface PaginationParams {
  page: number
  pageSize: number
}

/** 分页响应 */
export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
