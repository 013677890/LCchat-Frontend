import { describe, expect, it } from 'vitest'
import { buildFriendGroups } from './friend-grouping'

describe('buildFriendGroups', () => {
  it('groups friends by tag and keeps ungrouped fallback', () => {
    const groups = buildFriendGroups([
      { id: 'u1', title: 'Alice', groupTag: '工作' },
      { id: 'u2', title: 'Bob', groupTag: '' },
      { id: 'u3', title: 'Cindy', groupTag: '同学' }
    ])

    expect(groups.map((item) => item.label)).toEqual(['工作', '同学', '未分组'])
    expect(groups.find((item) => item.label === '工作')?.items.length).toBe(1)
    expect(groups.find((item) => item.label === '未分组')?.items[0]?.id).toBe('u2')
  })

  it('respects preferred tag order from backend full pull result', () => {
    const groups = buildFriendGroups(
      [
        { id: 'u1', title: 'Amy', groupTag: '家人' },
        { id: 'u2', title: 'Ben', groupTag: '工作' },
        { id: 'u3', title: 'Carl', groupTag: '同学' }
      ],
      ['工作', '同学', '家人']
    )

    expect(groups.map((item) => item.label)).toEqual(['工作', '同学', '家人'])
  })
})
