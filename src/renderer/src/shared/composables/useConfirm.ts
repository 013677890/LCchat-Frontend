import { reactive } from 'vue'

export interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  /** 危险操作：图标与确认按钮渲染为红色 */
  danger?: boolean
}

export interface PromptOptions extends ConfirmOptions {
  placeholder?: string
  initialValue?: string
}

interface DialogState {
  open: boolean
  title: string
  message: string
  confirmText: string
  cancelText: string
  danger: boolean
  withInput: boolean
  placeholder: string
  inputValue: string
}

// 模块级单例：全应用共享一个对话框宿主（ConfirmDialogHost 挂在 App.vue）
const state = reactive<DialogState>({
  open: false,
  title: '',
  message: '',
  confirmText: '确认',
  cancelText: '取消',
  danger: false,
  withInput: false,
  placeholder: '',
  inputValue: ''
})

let pendingConfirm: ((value: boolean) => void) | null = null
let pendingPrompt: ((value: string | null) => void) | null = null

function openDialog(options: ConfirmOptions, prompt?: PromptOptions): void {
  state.title = options.title
  state.message = options.message
  state.confirmText = options.confirmText || '确认'
  state.cancelText = options.cancelText || '取消'
  state.danger = options.danger ?? false
  state.withInput = Boolean(prompt)
  state.placeholder = prompt?.placeholder || ''
  state.inputValue = prompt?.initialValue || ''
  state.open = true
}

// 结算未决 Promise：取消语义下 confirm 得 false、prompt 得 null
function settle(confirmed: boolean): void {
  if (pendingConfirm) {
    pendingConfirm(confirmed)
    pendingConfirm = null
  }
  if (pendingPrompt) {
    pendingPrompt(confirmed ? state.inputValue : null)
    pendingPrompt = null
  }
}

/** 应用内确认框，替代原生 confirm()。resolve true=确认，false=取消 */
export function appConfirm(options: ConfirmOptions): Promise<boolean> {
  settle(false)
  return new Promise(resolve => {
    pendingConfirm = resolve
    openDialog(options)
  })
}

/** 应用内输入确认框，替代原生 prompt()。resolve 输入内容，取消时为 null */
export function appPrompt(options: PromptOptions): Promise<string | null> {
  settle(false)
  return new Promise(resolve => {
    pendingPrompt = resolve
    openDialog(options, options)
  })
}

/** 仅供 ConfirmDialogHost 驱动 UI 使用 */
export function useConfirmDialogState() {
  return {
    state,
    confirm(): void {
      settle(true)
      state.open = false
    },
    cancel(): void {
      settle(false)
      state.open = false
    }
  }
}
