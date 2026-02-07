import { describe, expect, it } from 'vitest'
import { resolveAuthErrorMessage } from './error-message'

function createBizError(code: number, message = 'fallback message'): Error & { bizCode: number } {
  const error = new Error(message) as Error & { bizCode: number }
  error.bizCode = code
  return error
}

describe('auth/error-message', () => {
  it('maps send-code frequent-limit error', () => {
    expect(resolveAuthErrorMessage('send_code', createBizError(11028))).toBe(
      '验证码发送过于频繁，请稍后再试。'
    )
  })

  it('maps verify-code-expire error for reset-password', () => {
    expect(resolveAuthErrorMessage('reset_password', createBizError(11007))).toBe(
      '验证码已过期，请重新获取。'
    )
  })

  it('returns normalized message when biz code is unknown', () => {
    expect(resolveAuthErrorMessage('code_login', new Error('network unavailable'))).toBe(
      'network unavailable'
    )
  })
})
