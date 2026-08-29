import { describe, expect, it, vi } from 'vitest'
import { writeTextToClipboard } from './clipboard'

describe('shared/utils/clipboard', () => {
  it('writes text through the provided bridge', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)

    await writeTextToClipboard('hello', { writeText })

    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('propagates bridge failures', async () => {
    const failure = new Error('clipboard unavailable')
    const writeText = vi.fn().mockRejectedValue(failure)

    await expect(writeTextToClipboard('hello', { writeText })).rejects.toBe(failure)
  })

  it('rejects when no clipboard implementation is available', async () => {
    await expect(writeTextToClipboard('hello', undefined)).rejects.toThrow(
      '当前环境不支持剪贴板写入'
    )
  })
})
