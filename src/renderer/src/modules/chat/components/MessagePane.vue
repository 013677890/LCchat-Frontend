<script setup lang="ts">
import { computed, nextTick, ref, watch, onMounted, onUnmounted } from 'vue'
import type { MessageRow } from '../../../shared/types/localdb'
import { Copy, CornerUpLeft, AlertCircle, Search, X, ChevronDown } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { renderMarkdown } from '../../../shared/utils/markdown'
import { avatarInitial, avatarPaletteFromId } from '../../../shared/utils/avatar'
import { resolveAssetUrl } from '../../../shared/utils/asset-url'

const props = defineProps<{
  title: string
  messages: MessageRow[]
  draft: string
  currentUserUuid: string
  isGroup: boolean
  currentUserGroupRole: number // 0=normal, 1=admin, 2=owner
  groupMembers?: any[]
  peerReadSeq?: number
  convId?: string
  /** 头部展示头像（单聊=对端头像，群聊=群头像），空则用首字色块 */
  conversationAvatar?: string
  /** 单聊对端头像，用于对端消息气泡旁 */
  peerAvatar?: string
  /** 当前登录用户头像，用于自己消息气泡旁 */
  selfAvatar?: string
  /** 单聊对端在线状态：true 在线 / false 离线 / null 未知（不展示） */
  peerOnline?: boolean | null
}>()

const emit = defineEmits<{
  'update:draft': [string]
  send: [string]
  recallMessage: [msgId: string]
  resendMessage: [clientMsgId: string]
}>()

const draftProxy = computed({
  get: () => props.draft,
  set: (value: string) => emit('update:draft', value)
})

// ------ Auto Scroll ------
const historyRef = ref<HTMLElement | null>(null)
// 距底部超过该距离时露出“回到底部”悬浮按钮
const showScrollFab = ref(false)
// 用户翻历史期间新到达的消息数（点击 FAB 或滚回底部后清零）
const pendingNewCount = ref(0)

function isNearBottom(): boolean {
  const el = historyRef.value
  if (!el) return true
  return el.scrollHeight - el.scrollTop - el.clientHeight < 120
}

async function scrollToBottom(): Promise<void> {
  await nextTick()
  const el = historyRef.value
  if (el) {
    el.scrollTop = el.scrollHeight
  }
}

function handleHistoryScroll(): void {
  const el = historyRef.value
  if (!el) return
  const distance = el.scrollHeight - el.scrollTop - el.clientHeight
  showScrollFab.value = distance > 300
  if (distance < 120) {
    pendingNewCount.value = 0
  }
}

function jumpToLatest(): void {
  pendingNewCount.value = 0
  void scrollToBottom()
}

// 切换会话：无条件回到底部（最新消息），并重置新消息角标。
watch(
  () => props.convId,
  () => {
    pendingNewCount.value = 0
    showScrollFab.value = false
    void scrollToBottom()
  },
  { immediate: true }
)

// 消息更新：贴近底部或最后一条是自己发的才跟随滚动，避免打断用户翻历史；
// 不跟随时累计新消息数，由悬浮按钮提示。
watch(
  () => props.messages,
  (nextMessages, prevMessages) => {
    if (nextMessages === prevMessages) return
    const lastMessage = nextMessages[nextMessages.length - 1]
    const lastIsSelf = lastMessage?.payload?.from === 'self'
    if (lastIsSelf || isNearBottom()) {
      pendingNewCount.value = 0
      void scrollToBottom()
    } else if (prevMessages && nextMessages.length > prevMessages.length) {
      pendingNewCount.value += nextMessages.length - prevMessages.length
    }
  }
)

// ------ P2P 已读回执 ------
// 后端 MSG_READ_RECEIPT 只对单聊下发；找到自己发出的最后一条已确认消息，
// 若其 seq 不超过对端已读位点则显示“已读”。
const lastSelfMessage = computed<MessageRow | null>(() => {
  for (let i = props.messages.length - 1; i >= 0; i -= 1) {
    const message = props.messages[i]
    if (message && message.payload.from === 'self' && message.status !== 1) {
      return message
    }
  }
  return null
})

function readReceiptText(message: MessageRow): string {
  if (props.isGroup || message !== lastSelfMessage.value) return ''
  const seq = message.seq ?? 0
  if (seq <= 0 || message.status === -1) return ''
  return seq <= (props.peerReadSeq ?? 0) ? '已读' : '未读'
}

function getText(message: MessageRow): string {
  const value = message.payload.text
  return typeof value === 'string' ? value : ''
}

function getFrom(message: MessageRow): 'self' | 'peer' {
  const value = message.payload.from
  return value === 'self' ? 'self' : 'peer'
}

function getTime(message: MessageRow): string {
  return new Date(message.sendTime).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getSenderName(message: MessageRow): string {
  const uuid = message.payload.fromUuid as string
  if (!uuid) return '未知'
  if (uuid === props.currentUserUuid) return '我'
  if (props.groupMembers) {
    const member = props.groupMembers.find(m => m.userUuid === uuid)
    if (member) {
      return member.groupNickname || member.nickname || uuid.substring(0, 8)
    }
  }
  // 单聊对端没有群成员表可查，直接用会话标题（好友备注/昵称）。
  if (!props.isGroup && props.title) {
    return props.title
  }
  return uuid.substring(0, 8)
}

// ------ 消息头像与聚簇 ------
// 头像解析优先级：自己 → selfAvatar；群聊对端 → 群成员表 avatar；单聊对端 → peerAvatar。
// 均无时回退为按 UUID 着色的首字色块。
function getMessageAvatarUrl(message: MessageRow): string {
  if (getFrom(message) === 'self') {
    return props.selfAvatar || ''
  }
  const uuid = (message.payload.fromUuid as string) || ''
  if (props.isGroup && props.groupMembers) {
    const member = props.groupMembers.find(m => m.userUuid === uuid)
    if (member?.avatar) {
      return resolveAssetUrl(member.avatar as string)
    }
    return ''
  }
  return props.peerAvatar || ''
}

function getMessageAvatarStyle(message: MessageRow): Record<string, string> {
  const uuid = (message.payload.fromUuid as string) || ''
  const palette = avatarPaletteFromId(uuid)
  return { background: palette.bg, color: palette.fg }
}

function getMessageAvatarInitial(message: MessageRow): string {
  return avatarInitial(getSenderName(message))
}

// 消息聚簇：同一发送者在 3 分钟内的连续消息只保留首条的头像和昵称，
// 后续消息用等宽占位对齐，减少视觉噪音（Telegram/Slack 风格）。
const CLUSTER_WINDOW_MS = 3 * 60 * 1000

function isClusterStart(index: number): boolean {
  if (shouldShowDivider(index)) return true
  const current = props.messages[index]
  const previous = props.messages[index - 1]
  if (!current || !previous) return true
  if (previous.status === 1) return true // 上一条已撤回，显示为居中系统条，重新起簇
  const currentUuid = (current.payload.fromUuid as string) || ''
  const previousUuid = (previous.payload.fromUuid as string) || ''
  if (currentUuid !== previousUuid) return true
  return current.sendTime - previous.sendTime > CLUSTER_WINDOW_MS
}

// ------ 头部信息 ------
const headerPalette = computed(() => avatarPaletteFromId(props.convId || props.title))

const headerSubtitle = computed(() => {
  if (props.isGroup) {
    return `群聊 · ${props.groupMembers?.length ?? 0} 名成员`
  }
  if (props.peerOnline === true) return '在线'
  if (props.peerOnline === false) return '离线'
  return '单聊'
})

const repliedMessage = ref<MessageRow | null>(null)

// 输入框有内容（非纯空白）才允许发送
const canSend = computed(() => draftProxy.value.trim().length > 0)

function handleDoubleClickBubble(message: MessageRow) {
  if (message.status === 1) return
  repliedMessage.value = message
}

function handleSend(): void {
  const text = draftProxy.value.trim()
  if (!text) {
    return
  }

  if (repliedMessage.value) {
    const sender = getSenderName(repliedMessage.value)
    const quoteText = getText(repliedMessage.value)
    // Create a beautiful standard blockquote format
    const formattedText = `> **回复 @${sender}**: ${quoteText}\n\n${text}`
    emit('send', formattedText)
    repliedMessage.value = null
  } else {
    emit('send', text)
  }
  void scrollToBottom()
  void nextTick(adjustComposerHeight)
}

// Enter 发送、Shift+Enter 换行；输入法组合中（拼音候选）回车不发送。
function handleComposerKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' || event.shiftKey) {
    return
  }
  if (event.isComposing) {
    return
  }
  event.preventDefault()
  handleSend()
}

// ------ Permission Aware Recall Logic ------
// 与后端 msg 域规则严格对齐（apps/msg/internal/domain/message/service.go RecallMessage）：
//   1) 自己的消息只能在 2 分钟窗口内撤回（管理员也不例外）；
//   2) 群主/管理员可以不限时撤回“他人”的消息；
//   3) 单聊里永远不能撤回对方的消息。
function canRecall(message: MessageRow): boolean {
  if (message.status === 1) return false // Already recalled

  const isSelf = message.payload.fromUuid === props.currentUserUuid
  const withinRecallWindow = Date.now() - message.sendTime < 120000

  if (isSelf) {
    return withinRecallWindow
  }

  return props.isGroup && props.currentUserGroupRole >= 1
}

// Context Menu State
const showMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const menuTargetMsgId = ref('')
const menuTargetText = ref('')
const menuTargetCanRecall = ref(false)

function openMessageMenu(event: MouseEvent, message: MessageRow) {
  if (message.status === 1) return // No menu for recalled messages
  
  event.preventDefault()
  menuTargetMsgId.value = message.msgId
  menuTargetText.value = getText(message)
  menuTargetCanRecall.value = canRecall(message)
  
  const menuWidth = 140
  const menuHeight = 80
  let x = event.clientX
  let y = event.clientY
  
  if (x + menuWidth > window.innerWidth) {
    x = window.innerWidth - menuWidth - 10
  }
  if (y + menuHeight > window.innerHeight) {
    y = window.innerHeight - menuHeight - 10
  }
  
  menuX.value = x
  menuY.value = y
  showMenu.value = true
}

function closeMessageMenu() {
  showMenu.value = false
}

function handleOutsideClick(event: MouseEvent) {
  if (showMenu.value) {
    closeMessageMenu()
  }
  if (showEmojiPicker.value) {
    const target = event.target as HTMLElement
    const picker = document.querySelector('.emoji-picker-container')
    const button = document.querySelector('.emoji-tool-btn')
    if (picker && !picker.contains(target) && button && !button.contains(target)) {
      showEmojiPicker.value = false
    }
  }
}

onMounted(() => {
  window.addEventListener('click', handleOutsideClick)
  window.addEventListener('contextmenu', handleOutsideClick)
})

onUnmounted(() => {
  window.removeEventListener('click', handleOutsideClick)
  window.removeEventListener('contextmenu', handleOutsideClick)
})

async function triggerCopy() {
  try {
    await navigator.clipboard.writeText(menuTargetText.value)
    toast.success('已复制到剪贴板')
  } catch (err) {
    toast.error('复制失败，请尝试手动复制')
  }
  closeMessageMenu()
}

function triggerRecall() {
  emit('recallMessage', menuTargetMsgId.value)
  closeMessageMenu()
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function processFiles(files: FileList) {
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (!file) continue
    
    // Detect typical text/developer file extensions
    const isText = file.type.startsWith('text/') || 
                   /\.(txt|md|json|js|ts|jsx|tsx|html|css|py|go|rs|c|cpp|h|sh|yml|yaml|xml)$/i.test(file.name)
                   
    if (isText) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result
        if (typeof content === 'string') {
          const header = `\n--- 文件: ${file.name} ---\n`
          draftProxy.value = (draftProxy.value ? draftProxy.value + '\n' : '') + header + content + '\n'
          toast.success(`成功导入文本文件: ${file.name}`)
        }
      }
      reader.onerror = () => {
        toast.error(`读取文件失败: ${file.name}`)
      }
      reader.readAsText(file)
    } else {
      // Elegant glassmorphic feedback for media/binary files
      toast.info(`“${file.name}” 是媒体/二进制文件。当前版本仅支持文本消息发送，已为您提取该文件的基本信息。`, {
        duration: 5000
      })
      draftProxy.value = (draftProxy.value ? draftProxy.value + ' ' : '') + `[文件: ${file.name} (${formatBytes(file.size)})]`
    }
  }
}

function handlePaste(event: ClipboardEvent) {
  const items = event.clipboardData?.items
  if (!items) return

  const files: File[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (!item) continue
    const file = item.getAsFile()
    if (file) {
      files.push(file)
    }
  }

  if (files.length > 0) {
    event.preventDefault()
    const dataTransfer = new DataTransfer()
    files.forEach(f => dataTransfer.items.add(f))
    processFiles(dataTransfer.files)
  }
}

function handleDrop(event: DragEvent) {
  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    processFiles(files)
  }
}

function emitResend(clientMsgId: string | undefined) {
  if (clientMsgId) {
    emit('resendMessage', clientMsgId)
  }
}

const composerTools = [
  { key: 'emoji', label: '表情', icon: '😊' },
  { key: 'image', label: '图片', icon: '🖼️' },
  { key: 'file', label: '文件', icon: '📎' }
]

// ------ Emoji Picker Core Logic ------
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const showEmojiPicker = ref(false)
const emojiSearchQuery = ref('')
const activeEmojiTab = ref('表情')

const emojiCategories = [
  {
    name: '表情',
    icon: '😃',
    emojis: [
      { char: '😀', tags: 'smile happy laugh face 笑 哈哈 快乐' },
      { char: '😃', tags: 'smile happy laugh face 笑 哈哈 快乐' },
      { char: '😄', tags: 'smile happy laugh face 笑 哈哈 快乐' },
      { char: '😁', tags: 'smile happy laugh face 笑 哈哈 快乐' },
      { char: '😆', tags: 'smile happy laugh face 笑 哈哈 快乐' },
      { char: '😅', tags: 'smile sweat happy laugh face 尴尬 笑 汗' },
      { char: '😂', tags: 'smile cry tears laugh face 搞笑 笑哭了 欢喜' },
      { char: '🤣', tags: 'smile roll tears laugh face 搞笑 爆笑' },
      { char: '😊', tags: 'smile blush happy face 害羞 微笑 温暖' },
      { char: '😇', tags: 'angel halo smile face 天使 善良' },
      { char: '🙂', tags: 'smile face 微笑 呵呵' },
      { char: '🙃', tags: 'upside down smile face 倒笑 调皮' },
      { char: '😉', tags: 'wink smile face 眨眼 挑逗' },
      { char: '😌', tags: 'relieved smile face 舒缓 宽慰' },
      { char: '😍', tags: 'love heart eyes smile face 喜欢 爱心 眼镜 崇拜' },
      { char: '🥰', tags: 'love hearts smile face 喜爱 温暖 幸福' },
      { char: '😘', tags: 'love blow kiss smile face 亲亲 飞吻 爱' },
      { char: '😗', tags: 'kiss smile face 亲亲 么么哒' },
      { char: '😙', tags: 'kiss smile face 亲亲 么么哒' },
      { char: '😚', tags: 'kiss blush smile face 亲亲 害羞 么么哒' },
      { char: '😋', tags: 'yum delicious tongue smile face 好吃 馋 吐舌' },
      { char: '😛', tags: 'tongue smile face 吐舌 调皮' },
      { char: '😝', tags: 'tongue squint smile face 吐舌 鬼脸' },
      { char: '😜', tags: 'tongue wink smile face 眨眼 吐舌 调皮' },
      { char: '🤪', tags: 'zany crazy tongue face 疯狂 搞怪 鬼脸' },
      { char: '🤨', tags: 'raised eyebrow face 疑惑 怀疑 挑眉' },
      { char: '🧐', tags: 'monocle face 观察 学问 思考' },
      { char: '🤓', tags: 'nerd glasses face 书呆子 极客 聪明' },
      { char: '😎', tags: 'cool sunglasses face 酷 墨镜 帅' },
      { char: '🤩', tags: 'star eyes smile face 崇拜 闪亮 惊喜' },
      { char: '🥳', tags: 'party celebrate horn face 庆祝 派对 生日' },
      { char: '😏', tags: 'smirk smile face 歪嘴笑 傲慢 坏笑' },
      { char: '😒', tags: 'unamused face 鄙视 不满 翻白眼' },
      { char: '😞', tags: 'disappointed face 失望 难过' },
      { char: '😔', tags: 'pensive face 沉思 忧郁 悲伤' },
      { char: '😟', tags: 'worried face 担心 焦虑' },
      { char: '😕', tags: 'confused face 困惑 纠结' },
      { char: '🙁', tags: 'frown face 难过 委屈' },
      { char: '☹️', tags: 'frown face 伤心 沮丧' },
      { char: '😣', tags: 'persevere face 坚持 痛苦' },
      { char: '😖', tags: 'confounded face 狼狈 抓狂' },
      { char: '😫', tags: 'tired face 累 疲惫' },
      { char: '😩', tags: 'weary face 疲倦 烦躁' },
      { char: '🥺', tags: 'pleading beg eyes face 可怜 恳求 撒娇' },
      { char: '😢', tags: 'cry tear sad face 流泪 伤心 哭' },
      { char: '😭', tags: 'cry sob loud tears sad face 大哭 伤心 流泪' },
      { char: '😤', tags: 'triumph steam angry face 生气 傲娇 哼' },
      { char: '😠', tags: 'angry mad face 生气 愤怒' },
      { char: '😡', tags: 'pout angry mad face 愤怒 暴怒 火大' },
      { char: '🤬', tags: 'swear curse mouth face 骂人 爆粗口 极其愤怒' },
      { char: '🤯', tags: 'explode head shock face 震惊 脑洞大开 懵了' },
      { char: '😳', tags: 'flushed blush shock face 脸红 尴尬 震惊' },
      { char: '🥵', tags: 'hot red sweat face 炎热 燥热 脸红 害羞' },
      { char: '🥶', tags: 'cold blue teeth face 寒冷 冻结 害怕' },
      { char: '😱', tags: 'scream fear shock face 恐惧 尖叫 震惊 吓死了' },
      { char: '🤫', tags: 'shush finger quiet face 安静 嘘 秘密' },
      { char: '🤐', tags: 'zipper mouth silent face 闭嘴 保密' },
      { char: '😴', tags: 'sleep zzz snoring face 睡觉 困了 晚安' }
    ]
  },
  {
    name: '手势',
    icon: '👋',
    emojis: [
      { char: '👋', tags: 'wave hello goodbye hand 招手 你好 再见' },
      { char: '👌', tags: 'ok hand fine good 好的 没问题 赞' },
      { char: '✌️', tags: 'victory peace fingers hand 耶 胜利 剪刀手' },
      { char: '👍', tags: 'thumbs up agree good hand 点赞 棒 顶' },
      { char: '👎', tags: 'thumbs down disagree bad hand 差评 弱 踩' },
      { char: '✊', tags: 'raised fist power hand 力量 拳头 奋斗' },
      { char: '👊', tags: 'oncoming fist punch hand 拳头 击掌 力量' },
      { char: '👏', tags: 'clap hands applause 鼓掌 赞扬 热烈' },
      { char: '🙌', tags: 'raise hands celebrate 欢呼 举双手 万岁' },
      { char: '🙏', tags: 'pray hands please thank you 祈祷 拜托 谢谢 感恩' },
      { char: '💪', tags: 'muscle biceps strength power 肌肉 力量 加油' }
    ]
  },
  {
    name: '爱心',
    icon: '❤️',
    emojis: [
      { char: '❤️', tags: 'love red heart 爱心 喜欢 红色' },
      { char: '🧡', tags: 'love orange heart 橙色 喜欢' },
      { char: '💛', tags: 'love yellow heart 黄色 喜欢' },
      { char: '💚', tags: 'love green heart 绿色 喜欢' },
      { char: '💙', tags: 'love blue heart 蓝色 喜欢' },
      { char: '💜', tags: 'love purple heart 紫色 喜欢' },
      { char: '🖤', tags: 'love black heart 黑色' },
      { char: '🤍', tags: 'love white heart 白色' },
      { char: '💔', tags: 'broken heart sad 伤心 心碎' },
      { char: '💖', tags: 'love sparkling heart 闪烁 爱心' },
      { char: '💗', tags: 'love growing heart 激动 喜欢' },
      { char: '💓', tags: 'love beating heart 心动 跳动' },
      { char: '💕', tags: 'love two hearts 双向 喜欢' },
      { char: '✨', tags: 'sparkles stars shine 闪亮 星星 闪烁' },
      { char: '⭐', tags: 'star gold yellow 星星 金色' },
      { char: '🔥', tags: 'fire hot burn flame 火 火热 热门 激情' },
      { char: '🎉', tags: 'party popper celebrate 恭喜 庆祝 洒花 派对' },
      { char: '🎁', tags: 'present gift box 礼物 惊喜 送礼' }
    ]
  }
]

const filteredEmojis = computed(() => {
  const query = emojiSearchQuery.value.trim().toLowerCase()
  if (!query) {
    const category = emojiCategories.find(c => c.name === activeEmojiTab.value)
    return category ? category.emojis : []
  }

  // Flatten and filter across all categories
  const allEmojis = emojiCategories.flatMap(c => c.emojis)
  // Deduplicate and filter
  const seen = new Set<string>()
  const results: typeof allEmojis = []
  for (const item of allEmojis) {
    if (!seen.has(item.char) && item.tags.toLowerCase().includes(query)) {
      seen.add(item.char)
      results.push(item)
    }
  }
  return results
})

function toggleEmojiPicker() {
  showEmojiPicker.value = !showEmojiPicker.value
  if (showEmojiPicker.value) {
    emojiSearchQuery.value = ''
  }
}

function insertEmoji(emojiChar: string) {
  if (!textareaRef.value) {
    draftProxy.value += emojiChar
    return
  }

  const el = textareaRef.value
  const startPos = el.selectionStart
  const endPos = el.selectionEnd
  const text = draftProxy.value

  draftProxy.value = text.substring(0, startPos) + emojiChar + text.substring(endPos)
  
  // Restore focus and cursor position after insertion
  const newCaretPos = startPos + emojiChar.length
  setTimeout(() => {
    el.focus()
    el.setSelectionRange(newCaretPos, newCaretPos)
  }, 0)
}

// ------ Timeline Divider Helpers ------
function shouldShowDivider(index: number): boolean {
  if (index === 0) return true
  const currentMsg = props.messages[index]
  const prevMsg = props.messages[index - 1]
  if (!currentMsg || !prevMsg) return false
  
  // 1. Sent on a different calendar day
  const currentDate = new Date(currentMsg.sendTime)
  const prevDate = new Date(prevMsg.sendTime)
  if (currentDate.toDateString() !== prevDate.toDateString()) {
    return true
  }

  // 2. Sent more than 5 minutes apart (300,000 milliseconds)
  const timeDiff = currentMsg.sendTime - prevMsg.sendTime
  if (timeDiff > 300000) {
    return true
  }

  return false
}

function formatDividerTime(timestamp: number): string {
  const date = new Date(timestamp)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  const timeText = date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })

  if (date.toDateString() === today.toDateString()) {
    return `今天 ${timeText}`
  } else if (date.toDateString() === yesterday.toDateString()) {
    return `昨天 ${timeText}`
  } else {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${timeText}`
  }
}

// ------ Bubble Quick Actions Helpers ------
function triggerQuickCopy(text: string) {
  navigator.clipboard.writeText(text)
  toast.success('已复制到剪贴板')
}

function triggerQuickRecall(msgId: string) {
  emit('recallMessage', msgId)
}

function handleToolClick(key: string) {
  if (key === 'emoji') {
    toggleEmojiPicker()
  } else if (key === 'image') {
    toast.info('当前版本仅支持文本聊天，您可以通过直接拖拽或粘贴文本/代码文件来快速导入内容。')
  } else if (key === 'file') {
    toast.info('您可以直接拖拽文本/代码文件到输入框，或复制后粘贴，系统会自动识别并导入。')
  }
}

const isTyping = ref(false)
let typingTimeout: any = null

// 输入框自适应高度：随内容增长，上限 160px 后内部滚动。
function adjustComposerHeight(): void {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`
}

watch(draftProxy, () => {
  void nextTick(adjustComposerHeight)
  if (!draftProxy.value) {
    isTyping.value = false
    return
  }
  isTyping.value = true
  if (typingTimeout) {
    clearTimeout(typingTimeout)
  }
  typingTimeout = setTimeout(() => {
    isTyping.value = false
  }, 1000)
})
</script>

<template>
  <section class="message-pane">
    <header class="header">
      <div class="header-left">
        <div class="header-avatar-wrap">
          <img
            v-if="props.conversationAvatar"
            :src="props.conversationAvatar"
            class="header-avatar"
            alt=""
          />
          <span
            v-else
            class="header-avatar header-avatar--initial"
            :style="{ background: headerPalette.bg, color: headerPalette.fg }"
          >
            {{ avatarInitial(props.title) }}
          </span>
          <span
            v-if="!props.isGroup && props.peerOnline !== null && props.peerOnline !== undefined"
            class="presence-dot"
            :class="{ 'presence-dot--online': props.peerOnline }"
          />
        </div>
        <div class="title-wrap">
          <h2>{{ props.title || '选择会话' }}</h2>
          <p :class="{ 'subtitle--online': props.peerOnline === true }">{{ headerSubtitle }}</p>
        </div>
      </div>
      <!-- slot injection point for ChatView extra controls -->
      <div class="actions-slot-wrap">
        <slot name="header-actions" />
      </div>
    </header>

    <div class="history-wrap">
      <main ref="historyRef" class="history" @scroll.passive="handleHistoryScroll">
      <div v-if="props.messages.length === 0" class="empty-state">
        <span
          class="empty-avatar"
          :style="{ background: headerPalette.bg, color: headerPalette.fg }"
        >
          {{ avatarInitial(props.title) }}
        </span>
        <p class="empty-title">和 {{ props.title || 'TA' }} 打个招呼吧</p>
        <p class="empty-hint">消息在服务端云端存储，多端同步</p>
      </div>
      <div v-else class="message-list">
        <template v-for="(message, index) in props.messages" :key="message.msgId">
          <!-- Center Timeline Divider Badge -->
          <div v-if="shouldShowDivider(index)" class="timeline-divider">
            <span>{{ formatDividerTime(message.sendTime) }}</span>
          </div>

          <!-- A. Recalled System notice -->
          <div v-if="message.status === 1" class="recalled-notice">
            <span>{{ getText(message) }}</span>
          </div>

          <!-- B. Normal Chat Bubble -->
          <article
            v-else
            class="bubble-row"
            :class="{
              'bubble-row--self': getFrom(message) === 'self',
              'bubble-row--continued': !isClusterStart(index)
            }"
          >
            <!-- 头像列：聚簇首条显示头像，后续消息占位对齐 -->
            <div class="avatar-col">
              <template v-if="isClusterStart(index)">
                <img
                  v-if="getMessageAvatarUrl(message)"
                  :src="getMessageAvatarUrl(message)"
                  class="msg-avatar"
                  alt=""
                />
                <span
                  v-else
                  class="msg-avatar msg-avatar--initial"
                  :style="getMessageAvatarStyle(message)"
                >
                  {{ getMessageAvatarInitial(message) }}
                </span>
              </template>
            </div>

            <div class="bubble-container">
              <span
                v-if="props.isGroup && getFrom(message) === 'peer' && isClusterStart(index)"
                class="sender-name"
              >
                {{ getSenderName(message) }}
              </span>
              <div class="bubble-wrapper group relative">
                <!-- Floating Glassmorphic Quick Action Bar -->
                <div class="bubble-action-bar">
                  <button
                    type="button"
                    class="action-btn"
                    title="复制文本"
                    @click="triggerQuickCopy(getText(message))"
                  >
                    <Copy :size="12" />
                  </button>
                  <button
                    v-if="canRecall(message)"
                    type="button"
                    class="action-btn action-btn--danger"
                    title="撤回消息"
                    @click="triggerQuickRecall(message.msgId)"
                  >
                    <CornerUpLeft :size="12" />
                  </button>
                </div>

                <button
                  v-if="message.status === -1"
                  type="button"
                  class="failed-retry-btn"
                  title="发送失败，点击重新发送"
                  @click="emitResend(message.clientMsgId)"
                >
                  <AlertCircle class="alert-icon" :size="18" />
                </button>
                <div
                  class="bubble cursor-pointer"
                  @contextmenu="openMessageMenu($event, message)"
                  @dblclick="handleDoubleClickBubble(message)"
                >
                  <p class="message-content-html" v-html="renderMarkdown(getText(message))"></p>
                  <time>{{ getTime(message) }}</time>
                </div>
              </div>
              <span
                v-if="getFrom(message) === 'self' && readReceiptText(message)"
                class="read-receipt"
                :class="{ 'read-receipt--read': readReceiptText(message) === '已读' }"
              >
                {{ readReceiptText(message) }}
              </span>
            </div>
          </article>
        </template>
      </div>
    </main>

      <!-- 悬浮“回到底部/新消息”按钮：固定在消息可视区右下角 -->
      <transition name="fab-pop">
        <button
          v-if="showScrollFab || pendingNewCount > 0"
          type="button"
          class="scroll-fab"
          :class="{ 'scroll-fab--unread': pendingNewCount > 0 }"
          @click="jumpToLatest"
        >
          <ChevronDown :size="15" />
          <span v-if="pendingNewCount > 0">{{ pendingNewCount > 99 ? '99+' : pendingNewCount }} 条新消息</span>
        </button>
      </transition>
    </div>

    <footer class="composer relative">
      <!-- Glassmorphic Reply Quote Card -->
      <transition name="slide-up">
        <div v-if="repliedMessage" class="reply-quote-card flex items-center justify-between px-6 py-3.5 border-b border-neutral-100 bg-white/70 backdrop-blur-md">
          <div class="flex items-center gap-3 overflow-hidden">
            <span class="reply-accent-bar" />
            <div class="flex flex-col text-left overflow-hidden">
              <span class="text-xs font-bold text-[var(--c-primary)] tracking-wide">
                回复 @{{ getSenderName(repliedMessage) }}
              </span>
              <span class="text-xs text-neutral-500 truncate max-w-[400px] mt-0.5">
                {{ getText(repliedMessage) }}
              </span>
            </div>
          </div>
          <button 
            type="button" 
            class="p-1 rounded-full text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition duration-150"
            title="取消回复"
            @click="repliedMessage = null"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </transition>

      <!-- Curated Glassmorphic Emoji Picker Drawer -->
      <transition name="slide-fade">
        <div v-if="showEmojiPicker" class="emoji-picker-container shadow-float">
          <!-- Search box -->
          <div class="emoji-picker-search">
            <Search :size="13" class="search-icon" />
            <input 
              v-model="emojiSearchQuery" 
              type="text" 
              placeholder="搜索表情名称(如:笑,心,smile)..." 
              class="search-input"
            />
            <button v-if="emojiSearchQuery" type="button" class="search-clear" @click="emojiSearchQuery = ''">
              <X :size="13" />
            </button>
          </div>
          
          <!-- Emojis Grid -->
          <div class="emoji-grid scrollbar-thin">
            <button 
              v-for="emoji in filteredEmojis" 
              :key="emoji.char" 
              type="button" 
              class="emoji-item"
              :title="emoji.tags"
              @click="insertEmoji(emoji.char)"
            >
              {{ emoji.char }}
            </button>
            <div v-if="filteredEmojis.length === 0" class="emoji-empty">
              没有找到匹配的表情
            </div>
          </div>

          <!-- Categories Tabs -->
          <div v-if="!emojiSearchQuery" class="emoji-picker-tabs">
            <button 
              v-for="cat in emojiCategories" 
              :key="cat.name"
              type="button"
              class="cat-tab"
              :class="{ 'cat-tab--active': activeEmojiTab === cat.name }"
              @click="activeEmojiTab = cat.name"
            >
              <span>{{ cat.icon }}</span>
              <small>{{ cat.name }}</small>
            </button>
          </div>
        </div>
      </transition>

      <div class="tool-row">
        <button 
          v-for="tool in composerTools" 
          :key="tool.key" 
          type="button" 
          :title="tool.label"
          :class="{ 'emoji-tool-btn': tool.key === 'emoji' }"
          @click="handleToolClick(tool.key)"
        >
          <span>{{ tool.icon }}</span>
          <small>{{ tool.label }}</small>
        </button>
      </div>
      <div class="textarea-wrap">
        <textarea
          ref="textareaRef"
          v-model="draftProxy"
          placeholder="输入消息，Enter 发送，Shift+Enter 换行，支持拖拽或粘贴文本文件..."
          rows="2"
          @keydown="handleComposerKeydown"
          @paste="handlePaste"
          @drop.prevent="handleDrop"
          @dragover.prevent
        />
        <button
          type="button"
          class="send-btn"
          :disabled="!canSend"
          @click="handleSend"
        >
          发送
        </button>
      </div>
      <div class="composer-actions">
        <span class="flex items-center gap-1.5 text-neutral-400">
          <span class="indicator-lock-dot" :class="{ 'indicator-lock-dot--typing': isTyping }"></span>
          <span>{{ isTyping ? '草稿已自动存入本地缓存' : '草稿自动保存 · 消息服务端存储' }}</span>
        </span>
        <span>Enter 发送 · Shift+Enter 换行</span>
      </div>
    </footer>

    <!-- Glassmorphic Message Context Menu -->
    <teleport to="body">
      <transition name="fade-menu">
        <div
          v-if="showMenu"
          class="context-menu"
          :style="{ left: menuX + 'px', top: menuY + 'px' }"
          @click.stop
        >
          <button type="button" class="menu-item" @click="triggerCopy">
            <Copy :size="13" class="icon" />
            <span>复制文本</span>
          </button>
          <button
            v-if="menuTargetCanRecall"
            type="button"
            class="menu-item menu-item--danger"
            @click="triggerRecall"
          >
            <CornerUpLeft :size="13" class="icon text-red-500" />
            <span class="text-red-500">撤回该消息</span>
          </button>
        </div>
      </transition>
    </teleport>
  </section>
</template>

<style scoped>
.message-pane {
  flex: 1;
  min-width: 0;
  background: var(--c-bg-app);
  display: flex;
  flex-direction: column;
  position: relative;
}

.header {
  min-height: 64px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: var(--blur-md);
  -webkit-backdrop-filter: var(--blur-md);
  position: sticky;
  top: 0;
  z-index: 10;
}

.header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--c-text-main);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.header-avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.header-avatar {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  object-fit: cover;
  display: block;
  box-shadow: var(--shadow-sm);
}

.header-avatar--initial {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  font-weight: 700;
  user-select: none;
}

/* 在线状态圆点：叠在头像右下角 */
.presence-dot {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 11px;
  height: 11px;
  border-radius: var(--radius-full);
  background: #c3ccd6;
  border: 2px solid #fff;
}

.presence-dot--online {
  background: var(--c-primary);
  box-shadow: 0 0 6px rgba(0, 198, 112, 0.6);
}

.subtitle--online {
  color: var(--c-primary) !important;
  font-weight: 600;
}

.title-wrap p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--c-text-sub);
}

.actions-slot-wrap {
  display: flex;
  align-items: center;
}

.history-wrap {
  flex: 1;
  min-height: 0;
  position: relative;
  display: flex;
  flex-direction: column;
}

.history {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  padding-bottom: 40px;
}

/* 悬浮“回到底部/新消息”按钮 */
.scroll-fab {
  position: absolute;
  right: 20px;
  bottom: 16px;
  display: flex;
  align-items: center;
  gap: 5px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: var(--blur-md);
  -webkit-backdrop-filter: var(--blur-md);
  color: var(--c-text-sub);
  font-size: 12px;
  font-weight: 600;
  padding: 8px 12px;
  cursor: pointer;
  box-shadow: var(--shadow-lg);
  z-index: 20;
  transition: all var(--duration-fast) var(--ease-out);
}

.scroll-fab:hover {
  color: var(--c-primary-active);
  border-color: rgba(0, 198, 112, 0.3);
  transform: translateY(-2px);
}

.scroll-fab--unread {
  background: var(--c-primary);
  border-color: var(--c-primary);
  color: #fff;
  box-shadow: 0 8px 20px rgba(0, 198, 112, 0.35);
}

.scroll-fab--unread:hover {
  background: var(--c-primary-hover);
  color: #fff;
}

.fab-pop-enter-active,
.fab-pop-leave-active {
  transition: opacity 0.18s var(--ease-out), transform 0.22s var(--ease-spring);
}

.fab-pop-enter-from,
.fab-pop-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.9);
}

.message-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.bubble-row {
  display: flex;
  justify-content: flex-start;
  align-items: flex-start;
  gap: 10px;
  margin-top: 14px;
  animation: slideUp 0.3s var(--ease-out) forwards;
}

/* 聚簇内的后续消息：紧贴上一条，头像列留白对齐 */
.bubble-row--continued {
  margin-top: 0;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.bubble-row--self {
  flex-direction: row-reverse;
  justify-content: flex-start;
}

/* 头像列：固定宽度，聚簇后续消息以空占位保持缩进 */
.avatar-col {
  width: 36px;
  flex-shrink: 0;
}

.msg-avatar {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  object-fit: cover;
  display: block;
  box-shadow: var(--shadow-sm);
  user-select: none;
}

.msg-avatar--initial {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 700;
}

.bubble-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: min(75%, 600px);
}

.bubble-row--self .bubble-container {
  align-items: flex-end;
}

.bubble-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bubble-row--self .bubble-wrapper {
  flex-direction: row;
}

.bubble-row:not(.bubble-row--self) .bubble-wrapper {
  flex-direction: row-reverse;
}

.failed-retry-btn {
  border: none;
  background: transparent;
  padding: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  transition: background var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--ease-out);
}

.failed-retry-btn:hover {
  background: rgba(239, 68, 68, 0.08);
  transform: scale(1.15);
}

.failed-retry-btn:active {
  transform: scale(0.9);
}

.alert-icon {
  color: #ef4444;
  animation: heartBeat 2s infinite ease-in-out;
}

@keyframes heartBeat {
  0% { transform: scale(1); }
  50% { transform: scale(1.12); opacity: 0.85; }
  100% { transform: scale(1); }
}

.sender-name {
  font-size: 11px;
  color: var(--c-text-sub);
  margin-left: 2px;
  font-weight: 500;
}

/* P2P 已读/未读回执，仅出现在自己最后一条已确认消息下方 */
.read-receipt {
  font-size: 10px;
  color: var(--c-text-muted);
  user-select: none;
  margin-right: 2px;
}

.read-receipt--read {
  color: var(--c-primary);
}

.bubble {
  border-radius: 16px 16px 16px 0; /* Asymmetric bottom-left tail for peer */
  padding: 11px 15px;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid rgba(0, 0, 0, 0.035);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.015);
  position: relative;
  transition: all var(--duration-fast) var(--ease-out);
}

.bubble:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.03);
}

.bubble-row--self .bubble {
  background: linear-gradient(135deg, #00d67a 0%, #00b164 100%);
  color: #fff;
  border-radius: 16px 16px 0 16px; /* Asymmetric bottom-right tail for self */
  box-shadow: 0 4px 14px rgba(0, 198, 112, 0.15);
  border: none;
}

.bubble-row--self .bubble:hover {
  box-shadow: 0 6px 20px rgba(0, 198, 112, 0.22);
}

/* 聚簇内的后续消息：不再带“尾巴”，统一全圆角 */
.bubble-row--continued .bubble,
.bubble-row--continued.bubble-row--self .bubble {
  border-radius: 16px;
}

.bubble p {
  margin: 0;
  color: inherit;
  line-height: 1.6;
  font-size: 13.5px;
  white-space: pre-wrap;
  word-break: break-word;
}

.bubble-row:not(.bubble-row--self) .bubble p {
  color: var(--c-text-main);
}

.bubble time {
  display: block;
  text-align: right;
  margin-top: 5px;
  font-size: 10px;
  font-weight: 500;
  opacity: 0.75;
  color: var(--c-text-muted);
  user-select: none;
}

.bubble-row--self .bubble time {
  color: rgba(255, 255, 255, 0.8);
}

.recalled-notice {
  display: flex;
  justify-content: center;
  margin: 6px 0;
  animation: fadeIn 0.2s ease-out;
}

.recalled-notice span {
  font-size: 11px;
  color: var(--c-text-muted);
  background: rgba(0, 0, 0, 0.03);
  padding: 4px 12px;
  border-radius: var(--radius-full);
  user-select: none;
}

/* 空会话引导态 */
.empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  user-select: none;
}

.empty-avatar {
  width: 64px;
  height: 64px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  font-weight: 700;
  margin-bottom: 8px;
  box-shadow: var(--shadow-md);
}

.empty-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--c-text-main);
}

.empty-hint {
  margin: 0;
  font-size: 12px;
  color: var(--c-text-muted);
}

.composer {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: var(--blur-md);
  -webkit-backdrop-filter: var(--blur-md);
  border-top: 1px solid rgba(0, 0, 0, 0.04);
  padding: 12px 24px 16px;
}

.tool-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.tool-row button {
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--c-text-sub);
  padding: 6px 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.tool-row button:hover {
  color: var(--c-text-main);
  background: var(--c-bg-hover);
  transform: translateY(-1px);
}

.tool-row span {
  font-size: 16px;
  font-weight: 600;
}

.tool-row small {
  font-size: 12px;
  font-weight: 500;
}

.textarea-wrap {
  position: relative;
}

.composer textarea {
  width: 100%;
  border: 1.5px solid transparent;
  border-radius: var(--radius-lg);
  background: #f4f6f8;
  resize: none;
  padding: 14px 90px 14px 16px;
  font-size: 15px;
  font-family: inherit;
  outline: none;
  min-height: 52px;
  max-height: 160px;
  overflow-y: auto;
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.02);
}

.composer textarea:focus {
  background: #fff;
  border-color: var(--c-primary-soft);
  box-shadow: 0 0 0 4px var(--c-primary-soft);
}

.composer textarea::placeholder {
  color: var(--c-text-muted);
}

.send-btn {
  position: absolute;
  right: 12px;
  bottom: 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--c-primary);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  padding: 8px 16px;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(0, 198, 112, 0.3);
  transition: all var(--duration-fast) var(--ease-spring);
}

.send-btn:hover {
  background: var(--c-primary-hover);
  transform: translateY(-2px);
  box-shadow: 0 6px 14px rgba(0, 198, 112, 0.4);
}

.send-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(0, 198, 112, 0.3);
}

/* 空文案时禁用发送：视觉灰化并禁止交互反馈 */
.send-btn:disabled {
  background: #c9d3dc;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

.composer-actions {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.composer-actions span {
  color: var(--c-text-muted);
  font-size: 12px;
}

/* Glassmorphic Context Menu */
.context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 130px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: var(--radius-md);
  padding: 4px;
  box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.12), 0 8px 12px -6px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.menu-item {
  width: 100%;
  border: none;
  background: transparent;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--c-text-main);
  font-size: 12px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.menu-item:hover {
  background: var(--c-primary-soft);
  color: var(--c-primary-active);
}

.menu-item .icon {
  flex-shrink: 0;
  color: var(--c-text-sub);
}

.menu-item:hover .icon {
  color: var(--c-primary-active);
}

.menu-item--danger {
  color: var(--c-danger);
}

.menu-item--danger:hover {
  background: rgba(239, 68, 68, 0.08);
}

.menu-item--danger .icon {
  color: var(--c-danger);
}

.fade-menu-enter-active,
.fade-menu-leave-active {
  transition: opacity 0.12s ease, transform 0.12s cubic-bezier(0.16, 1, 0.3, 1);
}

.fade-menu-enter-from {
  opacity: 0;
  transform: scale(0.96) translateY(-4px);
}

.fade-menu-leave-to {
  opacity: 0;
  transform: scale(0.98);
}


@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Markdown Content Styling */
.bubble p.message-content-html {
  white-space: normal;
}

/* Multiline Code Block */
:deep(.code-block) {
  background: rgba(30, 33, 38, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  margin: 8px 0;
  overflow-x: auto;
  font-family: 'Fira Code', 'Cascadia Code', Consolas, Monaco, monospace;
  font-size: 13px;
  text-align: left;
}

:deep(.code-block code) {
  color: #a9b1d6;
}

.bubble-row--self :deep(.code-block) {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.bubble-row--self :deep(.code-block code) {
  color: #e2f9ee;
}

/* Inline Code Snippets */
:deep(.code-inline) {
  background: rgba(0, 0, 0, 0.05);
  color: var(--c-danger);
  border-radius: var(--radius-sm);
  padding: 2px 6px;
  font-family: 'Fira Code', Consolas, monospace;
  font-size: 13px;
}

.bubble-row--self :deep(.code-inline) {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

/* Markdown Hyperlinks */
:deep(.markdown-link) {
  color: var(--c-primary);
  text-decoration: underline;
  font-weight: 500;
}

.bubble-row--self :deep(.markdown-link) {
  color: #e2f9ee;
  text-decoration: underline;
}

/* Date & Time Timeline Dividers */
.timeline-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 16px 0;
  width: 100%;
}

.timeline-divider span {
  font-size: 11px;
  color: var(--c-text-sub);
  background: rgba(0, 0, 0, 0.04);
  backdrop-filter: var(--blur-md);
  -webkit-backdrop-filter: var(--blur-md);
  padding: 4px 14px;
  border-radius: var(--radius-full);
  border: 1px solid rgba(0, 0, 0, 0.02);
  user-select: none;
  font-weight: 500;
  box-shadow: var(--shadow-sm);
}

/* Floating Bubble Hover Action Menu */
.bubble-action-bar {
  position: absolute;
  top: 50%;
  transform: translateY(-50%) scale(0.95);
  display: flex;
  align-items: center;
  gap: 3px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: var(--radius-md);
  padding: 4px;
  box-shadow: var(--shadow-md);
  opacity: 0;
  pointer-events: none;
  z-index: 5;
  transition: all var(--duration-fast) var(--ease-out);
}

.bubble-row--self .bubble-action-bar {
  left: -52px;
}

.bubble-row:not(.bubble-row--self) .bubble-action-bar {
  right: -52px;
}

.bubble-wrapper:hover .bubble-action-bar {
  opacity: 1;
  transform: translateY(-50%) scale(1);
  pointer-events: auto;
}

.action-btn {
  border: none;
  background: transparent;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--c-text-sub);
  transition: all var(--duration-fast) var(--ease-out);
}

.action-btn:hover {
  background: var(--c-primary-soft);
  color: var(--c-primary-active);
  transform: scale(1.05);
}

.action-btn--danger:hover {
  background: rgba(239, 68, 68, 0.1);
  color: var(--c-danger);
}

/* Glassmorphic Emoji Picker Container */
.emoji-picker-container {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 12px;
  width: 320px;
  height: 310px;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  z-index: 50;
  overflow: hidden;
  box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.15), 0 8px 16px -8px rgba(0, 0, 0, 0.1);
  transform-origin: bottom left;
}

.emoji-picker-search {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(0, 0, 0, 0.02);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  padding: 8px 12px;
}

.emoji-picker-search .search-icon {
  color: var(--c-text-muted);
}

.emoji-picker-search .search-input {
  border: none;
  background: transparent;
  outline: none;
  font-size: 12px;
  color: var(--c-text-main);
  flex: 1;
  padding: 0;
}

.emoji-picker-search .search-clear {
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--c-text-muted);
  padding: 2px;
  border-radius: var(--radius-full);
}

.emoji-picker-search .search-clear:hover {
  background: var(--c-bg-hover);
}

.emoji-grid {
  flex: 1;
  overflow-y: auto;
  padding: 10px 12px;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  align-content: start;
}

.emoji-item {
  border: none;
  background: transparent;
  font-size: 20px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--duration-fast) var(--ease-out);
}

.emoji-item:hover {
  background: var(--c-primary-soft);
  transform: scale(1.18);
}

.emoji-empty {
  grid-column: span 7;
  text-align: center;
  padding: 32px 0;
  font-size: 12px;
  color: var(--c-text-muted);
}

.emoji-picker-tabs {
  display: flex;
  align-items: center;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  background: rgba(255, 255, 255, 0.5);
  padding: 4px;
  justify-content: space-around;
}

.cat-tab {
  border: none;
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 10px;
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all var(--duration-fast) var(--ease-out);
  color: var(--c-text-muted);
}

.cat-tab:hover {
  background: var(--c-bg-hover);
  color: var(--c-text-main);
}

.cat-tab--active {
  background: var(--c-primary-soft) !important;
  color: var(--c-primary-active) !important;
}

.cat-tab span {
  font-size: 16px;
}

.cat-tab small {
  font-size: 9px;
  font-weight: 600;
}

/* Emoji Picker Slide Transition */
.slide-fade-enter-active {
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.slide-fade-leave-active {
  transition: all 0.18s cubic-bezier(0.33, 1, 0.68, 1);
}

.slide-fade-enter-from {
  opacity: 0;
  transform: scale(0.85) translateY(12px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(8px);
}

/* Glassmorphic Reply Card */
.reply-quote-card {
  position: relative;
  z-index: 10;
  border-top-left-radius: var(--radius-lg);
  border-top-right-radius: var(--radius-lg);
}

.reply-accent-bar {
  width: 3px;
  height: 24px;
  background-color: var(--c-primary);
  border-radius: 1.5px;
  box-shadow: 0 0 6px var(--c-primary);
}

/* Pulse Typing Heartbeat Lock */
.indicator-lock-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  background-color: var(--c-primary);
  opacity: 0.65;
  transition: all 0.3s ease;
}

.indicator-lock-dot--typing {
  background-color: #00E583;
  opacity: 1;
  box-shadow: 0 0 8px #00E583;
  animation: typing-heartbeat 0.8s infinite ease-in-out;
}

@keyframes typing-heartbeat {
  0%, 100% {
    transform: scale(1);
    opacity: 0.7;
  }
  50% {
    transform: scale(1.3);
    opacity: 1;
  }
}

/* Blockquote inside Message bubble */
.bubble p.message-content-html :deep(blockquote) {
  border-left: 3px solid var(--c-primary);
  background: rgba(0, 198, 112, 0.05);
  padding: 6px 12px;
  margin: 6px 0;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  font-size: 12.5px;
  color: var(--c-text-sub);
}

.bubble-row--self .bubble p.message-content-html :deep(blockquote) {
  border-left-color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.95);
}

/* Slide Up Transition for Quote Card */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s var(--ease-spring);
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
