import { describe, expect, it } from 'vitest'
import { resolveRelationErrorMessage } from './error-message'

describe('modules/contact/error-message', () => {
  it('returns mapped message when friend apply has already been sent', () => {
    const error = { bizCode: 12002 }
    expect(resolveRelationErrorMessage('send_friend_apply', error)).toBe(
      '好友申请已发送，请勿重复提交。'
    )
  })

  it('returns mapped message when deleting a non-friend', () => {
    const error = { bizCode: 12003 }
    expect(resolveRelationErrorMessage('delete_friend', error)).toBe('当前已不是好友关系。')
  })

  it('returns mapped message when target already in blacklist', () => {
    const error = { bizCode: 16003 }
    expect(resolveRelationErrorMessage('add_blacklist', error)).toBe('对方已在黑名单中。')
  })

  it('returns auth-expired message for auth status codes', () => {
    const error = { bizCode: 20002 }
    expect(resolveRelationErrorMessage('remove_blacklist', error)).toBe(
      '登录状态失效，请重新登录。'
    )
  })

  it('returns mapped message for friend remark length limit', () => {
    const error = { bizCode: 11024 }
    expect(resolveRelationErrorMessage('set_friend_remark', error)).toBe('备注长度超出限制。')
  })

  it('returns mapped message for invalid friend tag', () => {
    const error = { bizCode: 12010 }
    expect(resolveRelationErrorMessage('set_friend_tag', error)).toBe('标签名称无效，请重新输入。')
  })

  it('falls back to normalized message', () => {
    const error = new Error('fallback relation error')
    expect(resolveRelationErrorMessage('add_blacklist', error)).toBe('fallback relation error')
  })
})
