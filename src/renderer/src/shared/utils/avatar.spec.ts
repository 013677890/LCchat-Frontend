import { describe, expect, it } from 'vitest'
import { avatarInitial, avatarPaletteFromId } from './avatar'

describe('shared/utils/avatar', () => {
  it('maps the same id to the same palette deterministically', () => {
    const first = avatarPaletteFromId('123456789012345678')
    const second = avatarPaletteFromId('123456789012345678')
    expect(first).toEqual(second)
    expect(first.bg).toMatch(/^#/)
    expect(first.fg).toMatch(/^#/)
  })

  it('falls back to the muted palette for empty ids', () => {
    expect(avatarPaletteFromId('')).toEqual(avatarPaletteFromId('   '))
  })

  it('extracts the first character of chinese and latin names', () => {
    expect(avatarInitial('张三')).toBe('张')
    expect(avatarInitial('alice')).toBe('A')
    expect(avatarInitial('  bob ')).toBe('B')
  })

  it('handles surrogate pairs and empty names safely', () => {
    expect(avatarInitial('😀笑脸')).toBe('😀')
    expect(avatarInitial('')).toBe('?')
  })
})
