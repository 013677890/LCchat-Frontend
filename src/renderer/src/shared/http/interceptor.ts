import type { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import type { ApiResponse } from '../types/api'
import { getDeviceId } from '../utils/device'

interface ApiBusinessError extends Error {
  code: number
  traceId: string
}

function createBusinessError(code: number, message: string, traceId: string): ApiBusinessError {
  const error = new Error(message) as ApiBusinessError
  error.code = code
  error.traceId = traceId
  return error
}

async function attachHeaders(config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> {
  const nextConfig = config
  const deviceId = await getDeviceId()
  const headers = nextConfig.headers as Record<string, string>
  headers['X-Device-ID'] = deviceId
  headers['Content-Type'] = 'application/json'

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
    throw createBusinessError(payload.code, payload.message ?? '业务请求失败', payload.trace_id ?? '')
  }

  return response
}

function normalizeTransportError(error: AxiosError): Promise<never> {
  if (error.response?.status === 401) {
    return Promise.reject(new Error('登录状态已失效，请重新登录'))
  }

  return Promise.reject(error)
}

export function installHttpInterceptors(instance: AxiosInstance): void {
  instance.interceptors.request.use(attachHeaders)
  instance.interceptors.response.use(unwrapBusinessCode, normalizeTransportError)
}
