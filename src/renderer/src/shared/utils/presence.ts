export interface PresenceViewState {
  isOnline: boolean | null
  lastSeenAt?: string | number | null
}

function parseLastSeenAt(lastSeenAt?: string | number | null): Date | null {
  if (typeof lastSeenAt === 'number') {
    if (!Number.isFinite(lastSeenAt) || lastSeenAt <= 0) {
      return null
    }
    const date = new Date(lastSeenAt)
    return Number.isNaN(date.getTime()) ? null : date
  }

  if (typeof lastSeenAt !== 'string') {
    return null
  }

  const trimmed = lastSeenAt.trim()
  if (!trimmed) {
    return null
  }

  if (/^\d+$/.test(trimmed)) {
    const numericValue = Number(trimmed)
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return null
    }
    const fromNumber = new Date(numericValue)
    return Number.isNaN(fromNumber.getTime()) ? null : fromNumber
  }

  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function formatLastSeenAt(lastSeenAt?: string | number | null): string {
  const date = parseLastSeenAt(lastSeenAt)
  if (!date) {
    return ''
  }

  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  const sameYear = date.getFullYear() === now.getFullYear()

  if (sameDay) {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  if (sameYear) {
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

export function formatPresenceStatusText(state: PresenceViewState): string {
  if (state.isOnline === true) {
    return '在线'
  }

  if (state.isOnline === false) {
    const formattedLastSeenAt = formatLastSeenAt(state.lastSeenAt)
    return formattedLastSeenAt ? `离线 · ${formattedLastSeenAt}` : '离线'
  }

  return '状态未知'
}
