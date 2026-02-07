import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig
} from 'axios'
import type { SessionData } from '../../../../shared/types/localdb'
import type { ApiResponse } from '../types/api'
import { getDeviceId } from '../utils/device'
import { refreshSessionToken } from './session-refresh'

interface ApiBusinessError extends Error {
  bizCode: number
  traceId: string
  config?: InternalAxiosRequestConfig
}

function createBusinessError(code: number, message: string, traceId: string): ApiBusinessError {
  const error = new Error(message) as ApiBusinessError
  error.bizCode = code
  error.traceId = traceId
  return error
}

async function attachHeaders(
  config: InternalAxiosRequestConfig
): Promise<InternalAxiosRequestConfig> {
  const nextConfig = config
  const deviceId = await getDeviceId()
  const headers = nextConfig.headers as Record<string, string>
  headers['X-Device-ID'] = deviceId

  const isFormDataRequest =
    typeof FormData !== 'undefined' && nextConfig.data instanceof FormData
  if (!isFormDataRequest) {
    headers['Content-Type'] = 'application/json'
  } else if (typeof headers['Content-Type'] === 'string') {
    delete headers['Content-Type']
  }

  const session = await window.api.session.get()
  if (session?.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`
  }

  return nextConfig
}

function unwrapBusinessCode(response: AxiosResponse): AxiosResponse {
  const payload = response.data as Partial<ApiResponse<unknown>> | undefined
  if (!payload || typeof payload.code !== 'number') {
    return response
  }

  if (payload.code !== 0) {
    const error = createBusinessError(
      payload.code,
      payload.message ?? '业务请求失败',
      payload.trace_id ?? ''
    )
    error.config = response.config
    throw error
  }

  return response
}

type RetryableConfig = InternalAxiosRequestConfig & {
  _retried?: boolean
}

const TOKEN_ERROR_CODES = new Set([20002, 20003])
let refreshPromise: Promise<SessionData | null> | null = null

function isAuthFreeEndpoint(url?: string): boolean {
  if (!url) {
    return false
  }

  return (
    url.includes('/api/v1/public/user/login') ||
    url.includes('/api/v1/public/user/login-by-code') ||
    url.includes('/api/v1/public/user/refresh-token')
  )
}

function canRetry(config?: InternalAxiosRequestConfig): config is RetryableConfig {
  if (!config) {
    return false
  }

  const retryable = config as RetryableConfig
  if (retryable._retried) {
    return false
  }

  if (isAuthFreeEndpoint(config.url)) {
    return false
  }

  return true
}

function isTokenBusinessError(error: unknown): error is ApiBusinessError {
  if (!error || typeof error !== 'object') {
    return false
  }

  const bizCode = (error as ApiBusinessError).bizCode
  return typeof bizCode === 'number' && TOKEN_ERROR_CODES.has(bizCode)
}

async function refreshSessionOnce(): Promise<SessionData | null> {
  if (!refreshPromise) {
    refreshPromise = refreshSessionToken().finally(() => {
      refreshPromise = null
    })
  }

  return refreshPromise
}

async function retryWithFreshToken(
  instance: AxiosInstance,
  config: RetryableConfig
): Promise<AxiosResponse> {
  config._retried = true

  const nextSession = await refreshSessionOnce()
  if (!nextSession?.accessToken) {
    await window.api.session.clear()
    throw new Error('登录状态已失效，请重新登录')
  }

  const headers = config.headers as Record<string, string>
  headers.Authorization = `Bearer ${nextSession.accessToken}`
  return instance.request(config)
}

async function normalizeTransportError(
  instance: AxiosInstance,
  error: unknown
): Promise<AxiosResponse> {
  if (isTokenBusinessError(error) && canRetry(error.config)) {
    return retryWithFreshToken(instance, error.config)
  }

  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401 && canRetry(error.config)) {
      return retryWithFreshToken(instance, error.config)
    }

    return Promise.reject(error)
  }

  return Promise.reject(error)
}

export function installHttpInterceptors(instance: AxiosInstance): void {
  instance.interceptors.request.use(attachHeaders)
  instance.interceptors.response.use(unwrapBusinessCode, (error: unknown) =>
    normalizeTransportError(instance, error)
  )
}
