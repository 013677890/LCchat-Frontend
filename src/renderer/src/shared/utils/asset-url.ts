interface ResolveAssetUrlOptions {
  apiBaseUrl?: string
  rewriteInternalHost?: boolean
}

const DEFAULT_API_BASE_URL = 'http://localhost:8080'
const INTERNAL_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'minio',
  'gateway',
  'user',
  'auth',
  'backend'
])

function resolveApiBaseUrl(options?: ResolveAssetUrlOptions): string {
  if (typeof options?.apiBaseUrl === 'string' && options.apiBaseUrl.trim()) {
    return options.apiBaseUrl.trim()
  }

  const envBaseUrl = import.meta.env.VITE_API_BASE_URL
  if (typeof envBaseUrl === 'string' && envBaseUrl.trim()) {
    return envBaseUrl.trim()
  }

  return DEFAULT_API_BASE_URL
}

function isInternalHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase()
  if (!normalized) {
    return false
  }
  if (INTERNAL_HOSTS.has(normalized)) {
    return true
  }
  if (!normalized.includes('.') && !/^\d+\.\d+\.\d+\.\d+$/.test(normalized)) {
    return true
  }
  return normalized.endsWith('.local') || normalized.endsWith('.internal')
}

export function resolveAssetUrl(value: string, options: ResolveAssetUrlOptions = {}): string {
  const normalized = value.trim()
  if (!normalized) {
    return ''
  }
  if (/^(data|blob):/i.test(normalized)) {
    return normalized
  }

  let baseUrl: URL | null = null
  try {
    baseUrl = new URL(resolveApiBaseUrl(options))
  } catch {
    baseUrl = null
  }

  try {
    const target = new URL(normalized)
    if (!baseUrl || options.rewriteInternalHost === false) {
      return target.toString()
    }

    if (isInternalHost(target.hostname) && target.hostname !== baseUrl.hostname) {
      target.hostname = baseUrl.hostname
      if (baseUrl.protocol === 'https:' && target.protocol === 'http:') {
        target.protocol = 'https:'
      }
    }
    return target.toString()
  } catch {
    if (!baseUrl) {
      return normalized
    }
    try {
      return new URL(normalized, baseUrl).toString()
    } catch {
      return normalized
    }
  }
}
