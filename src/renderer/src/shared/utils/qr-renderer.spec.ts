import { describe, expect, it } from 'vitest'
import { buildQRCodeDataUrl } from './qr-renderer'

describe('shared/utils/qr-renderer', () => {
  it('builds svg data url from normal text', () => {
    const dataUrl = buildQRCodeDataUrl('https://example.com/q/demo')
    expect(dataUrl.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true)
    expect(dataUrl.length).toBeGreaterThan(128)
  })

  it('returns empty string for empty content', () => {
    expect(buildQRCodeDataUrl('   ')).toBe('')
  })
})
