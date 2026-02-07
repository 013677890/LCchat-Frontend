export interface FriendGroupItem {
  id: string
  title: string
  groupTag?: string
}

export interface FriendGroup<T extends FriendGroupItem> {
  key: string
  label: string
  count: number
  items: T[]
}

function normalizeTagName(tag?: string): string {
  const value = (tag ?? '').trim()
  return value || '未分组'
}

function compareByTitle<T extends FriendGroupItem>(a: T, b: T): number {
  return a.title.localeCompare(b.title, 'zh-CN')
}

export function buildFriendGroups<T extends FriendGroupItem>(
  items: T[],
  preferredTagOrder: string[] = []
): FriendGroup<T>[] {
  if (items.length === 0) {
    return []
  }

  const orderMap = new Map<string, number>()
  preferredTagOrder.forEach((tag, index) => {
    const normalizedTag = normalizeTagName(tag)
    if (!orderMap.has(normalizedTag)) {
      orderMap.set(normalizedTag, index)
    }
  })

  const grouped = new Map<string, T[]>()
  for (const item of items) {
    const tagName = normalizeTagName(item.groupTag)
    const list = grouped.get(tagName) ?? []
    list.push(item)
    grouped.set(tagName, list)
  }

  return [...grouped.entries()]
    .map(([tagName, groupItems]) => ({
      key: tagName === '未分组' ? 'ungrouped' : `tag:${tagName}`,
      label: tagName,
      count: groupItems.length,
      items: [...groupItems].sort(compareByTitle)
    }))
    .sort((a, b) => {
      const aOrder = orderMap.has(a.label)
        ? (orderMap.get(a.label) as number)
        : Number.MAX_SAFE_INTEGER
      const bOrder = orderMap.has(b.label)
        ? (orderMap.get(b.label) as number)
        : Number.MAX_SAFE_INTEGER
      if (aOrder !== bOrder) {
        return aOrder - bOrder
      }
      if (a.label === '未分组') {
        return 1
      }
      if (b.label === '未分组') {
        return -1
      }
      return a.label.localeCompare(b.label, 'zh-CN')
    })
}
