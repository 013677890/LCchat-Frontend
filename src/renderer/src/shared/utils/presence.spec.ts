import { describe, expect, it } from 'vitest'
import { formatLastSeenAt, formatPresenceStatusText } from './presence'

describe('presence formatter', () => {
  it('returns online text when user is online', () => {
    expect(formatPresenceStatusText({ isOnline: true, lastSeenAt: '' })).toBe('在线')
  })

  it('returns unknown when status is missing', () => {
    expect(formatPresenceStatusText({ isOnline: null, lastSeenAt: '' })).toBe('状态未知')
  })

  it('formats offline text with normalized last seen time', () => {
    const timestamp = Date.now() - 3 * 60 * 1000
    const formatted = formatPresenceStatusText({
      isOnline: false,
      lastSeenAt: String(timestamp)
    })

    expect(formatted.startsWith('离线 · ')).toBe(true)
  })

  it('returns empty string for invalid last seen value', () => {
    expect(formatLastSeenAt('invalid-date')).toBe('')
  })
})
