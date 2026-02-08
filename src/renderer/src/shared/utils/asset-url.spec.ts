import { describe, expect, it } from 'vitest'
import { resolveAssetUrl } from './asset-url'

describe('shared/utils/asset-url', () => {
  it('returns empty string when value is empty', () => {
    expect(resolveAssetUrl('   ')).toBe('')
  })

  it('resolves relative url with api base origin', () => {
    expect(resolveAssetUrl('/uploads/avatar.png', { apiBaseUrl: 'http://localhost:8080' })).toBe(
      'http://localhost:8080/uploads/avatar.png'
    )
  })

  it('keeps public absolute url untouched', () => {
    expect(resolveAssetUrl('https://cdn.example.com/avatar.png')).toBe(
      'https://cdn.example.com/avatar.png'
    )
  })

  it('rewrites internal host to api host', () => {
    expect(resolveAssetUrl('http://minio:9000/avatars/user.png', { apiBaseUrl: 'http://localhost:8080' })).toBe(
      'http://localhost:9000/avatars/user.png'
    )
  })

  it('keeps data and blob urls untouched', () => {
    expect(resolveAssetUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc')
    expect(resolveAssetUrl('blob:https://example.com/file-id')).toBe(
      'blob:https://example.com/file-id'
    )
  })
})
