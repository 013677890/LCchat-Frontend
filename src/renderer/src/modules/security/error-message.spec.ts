import { describe, expect, it } from 'vitest'
import { isSendTooFrequentError, resolveSecurityErrorMessage } from './error-message'

describe('modules/security/error-message', () => {
  it('returns mapped message for send verify code frequency limit', () => {
    const error = { bizCode: 11028 }
    expect(resolveSecurityErrorMessage('send_email_code', error)).toBe(
      '验证码发送过于频繁，请稍后再试。'
    )
    expect(isSendTooFrequentError(error)).toBe(true)
  })

  it('returns mapped message for email already exists', () => {
    const error = { bizCode: 11015 }
    expect(resolveSecurityErrorMessage('change_email', error)).toBe(
      '该邮箱已被使用，请更换后重试。'
    )
  })

  it('returns auth-expired message for auth status codes', () => {
    const error = { bizCode: 20003 }
    expect(resolveSecurityErrorMessage('change_password', error)).toBe('登录状态失效，请重新登录。')
  })

  it('falls back to normalized message when no mapping exists', () => {
    const error = new Error('fallback message')
    expect(resolveSecurityErrorMessage('delete_account', error)).toBe('fallback message')
    expect(isSendTooFrequentError(error)).toBe(false)
  })
})
