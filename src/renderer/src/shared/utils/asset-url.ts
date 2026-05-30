import avatarMe from '../../assets/avatar_me.png'
import avatarFriend1 from '../../assets/avatar_friend1.png'

interface ResolveAssetUrlOptions {
  apiBaseUrl?: string
  rewriteInternalHost?: boolean
  fallbackType?: 'me' | 'friend'
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

export function resolveAssetUrl(value: string | null | undefined, options: ResolveAssetUrlOptions = {}): string {
  const normalized = (value || '').trim()
  
  if (normalized === 'default_me' || (!normalized && options.fallbackType === 'me')) {
    return avatarMe
  }
  if (normalized === 'default_friend' || (!normalized && options.fallbackType === 'friend')) {
    return avatarFriend1
  }

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
