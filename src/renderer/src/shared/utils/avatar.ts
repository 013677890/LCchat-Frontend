/**
 * 首字头像工具：无头像图时按 ID 稳定映射到一组和谐色板，
 * 供消息气泡、会话列表、聊天头部等处统一使用。
 */

export interface AvatarPalette {
  /** 背景色（柔和浅色） */
  bg: string
  /** 前景文字色（同色系深色） */
  fg: string
}

// 8 组低饱和背景 + 深色前景，视觉上与主色（绿色）协调。
const PALETTES: AvatarPalette[] = [
  { bg: '#E8F5EC', fg: '#1F7A46' }, // 绿
  { bg: '#E8F0FB', fg: '#2563EB' }, // 蓝
  { bg: '#FDF0E7', fg: '#C2570C' }, // 橙
  { bg: '#F3EDFB', fg: '#7C3AED' }, // 紫
  { bg: '#FDECEF', fg: '#DB2777' }, // 玫红
  { bg: '#E7F6F8', fg: '#0E7490' }, // 青
  { bg: '#FBF3DF', fg: '#A16207' }, // 金
  { bg: '#EEF1F5', fg: '#475569' } // 石板灰
]

/** 将任意 ID 稳定散列到色板；空 ID 落在最后一组（灰）。 */
export function avatarPaletteFromId(id: string): AvatarPalette {
  const normalized = (id || '').trim()
  if (!normalized) {
    return PALETTES[PALETTES.length - 1]!
  }

  let hash = 0
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0
  }
  return PALETTES[hash % PALETTES.length]!
}

/** 取展示名的首字：中文取第一个字，英文取首字母并大写，空名回退 "?"。 */
export function avatarInitial(name: string): string {
  const normalized = (name || '').trim()
  if (!normalized) {
    return '?'
  }
  // Array.from 按码点切分，避免 emoji/扩展区汉字被截成乱码。
  const first = Array.from(normalized)[0] ?? '?'
  return first.toUpperCase()
}
