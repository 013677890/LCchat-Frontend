import { describe, expect, it } from 'vitest'
import { extractQRCodeToken } from './qrcode'

describe('shared/utils/qrcode', () => {
  it('returns empty string for blank input', () => {
    expect(extractQRCodeToken('   ')).toBe('')
  })

  it('returns token directly when raw token is provided', () => {
    expect(extractQRCodeToken('token-abc-123')).toBe('token-abc-123')
  })

  it('extracts token from q path url', () => {
    expect(extractQRCodeToken('https://www.LCchat.top/q/token_xyz?from=scan')).toBe('token_xyz')
  })

  it('extracts token from qrcode scheme text', () => {
    expect(extractQRCodeToken('qrcode: token_1')).toBe('token_1')
  })

  it('extracts token from query token when no q path exists', () => {
    expect(extractQRCodeToken('https://www.LCchat.top/parse?token=query_token')).toBe('query_token')
  })
})
