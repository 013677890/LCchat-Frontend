import { describe, expect, it } from 'vitest'
import { appConfirm, appPrompt, useConfirmDialogState } from './useConfirm'

describe('shared/composables/useConfirm', () => {
  it('appConfirm 在宿主确认后 resolve true', async () => {
    const { state, confirm } = useConfirmDialogState()
    const pending = appConfirm({ title: '删除', message: '确定吗？', danger: true })
    expect(state.open).toBe(true)
    expect(state.danger).toBe(true)
    expect(state.withInput).toBe(false)
    confirm()
    await expect(pending).resolves.toBe(true)
    expect(state.open).toBe(false)
  })

  it('appConfirm 在宿主取消后 resolve false', async () => {
    const { cancel } = useConfirmDialogState()
    const pending = appConfirm({ title: '退出', message: '确认退出？' })
    cancel()
    await expect(pending).resolves.toBe(false)
  })

  it('appPrompt 确认时带回输入值，取消时得到 null', async () => {
    const { state, confirm, cancel } = useConfirmDialogState()

    const first = appPrompt({ title: '附言', message: '填写理由', initialValue: '你好' })
    expect(state.withInput).toBe(true)
    state.inputValue = '重新申请'
    confirm()
    await expect(first).resolves.toBe('重新申请')

    const second = appPrompt({ title: '附言', message: '填写理由' })
    cancel()
    await expect(second).resolves.toBeNull()
  })

  it('重复打开时上一个未决 Promise 按取消结算，避免悬挂', async () => {
    const { cancel } = useConfirmDialogState()
    const first = appConfirm({ title: 'A', message: 'a' })
    const second = appConfirm({ title: 'B', message: 'b' })
    await expect(first).resolves.toBe(false)
    cancel()
    await expect(second).resolves.toBe(false)
  })
})
