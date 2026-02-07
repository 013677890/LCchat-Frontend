<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  qrCodeUrl: string
  qrCodeToken: string
  expireAt: string
  loading?: boolean
  parsing?: boolean
  message?: string
  errorMessage?: string
}>()

const emit = defineEmits<{
  refresh: []
  parse: [input: string]
  clearFeedback: []
}>()

const parseInput = ref('')
const copyMessage = ref('')
const copyError = ref('')

const expireText = computed(() => {
  if (!props.expireAt) {
    return '-'
  }

  const date = new Date(props.expireAt)
  if (Number.isNaN(date.getTime())) {
    return props.expireAt
  }

  return date.toLocaleString('zh-CN')
})

function clearLocalCopyFeedback(): void {
  copyMessage.value = ''
  copyError.value = ''
}

function handleParseInput(event: Event): void {
  parseInput.value = (event.target as HTMLInputElement).value
  clearLocalCopyFeedback()
  emit('clearFeedback')
}

function handleRefresh(): void {
  emit('clearFeedback')
  clearLocalCopyFeedback()
  emit('refresh')
}

function handleParse(): void {
  const input = parseInput.value.trim()
  if (!input || props.parsing) {
    return
  }

  clearLocalCopyFeedback()
  emit('clearFeedback')
  emit('parse', input)
}

async function copyQRCodeUrl(): Promise<void> {
  if (!props.qrCodeUrl) {
    return
  }

  emit('clearFeedback')
  clearLocalCopyFeedback()

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(props.qrCodeUrl)
      copyMessage.value = '二维码链接已复制。'
      return
    }

    const textArea = document.createElement('textarea')
    textArea.value = props.qrCodeUrl
    textArea.style.position = 'fixed'
    textArea.style.left = '-9999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(textArea)
    if (copied) {
      copyMessage.value = '二维码链接已复制。'
      return
    }

    copyError.value = '复制失败，请手动复制。'
  } catch (error) {
    copyError.value = error instanceof Error ? error.message : '复制失败，请手动复制。'
  }
}
</script>

<template>
  <section class="qrcode-card">
    <header class="card-header">
      <h3>我的二维码</h3>
      <button
        type="button"
        class="action-btn action-btn--ghost"
        :disabled="props.loading"
        @click="handleRefresh"
      >
        {{ props.loading ? '刷新中...' : '刷新二维码' }}
      </button>
    </header>

    <p class="hint">可复制链接给其他用户，或粘贴二维码链接/Token 进行解析。</p>

    <div class="qrcode-url-wrap">
      <label>二维码链接</label>
      <div class="url-row">
        <input :value="props.qrCodeUrl || '-'" readonly />
        <button
          type="button"
          class="action-btn action-btn--ghost"
          :disabled="!props.qrCodeUrl"
          @click="copyQRCodeUrl"
        >
          复制
        </button>
      </div>
    </div>

    <div class="meta-grid">
      <p>
        <span>Token</span>
        <strong>{{ props.qrCodeToken || '-' }}</strong>
      </p>
      <p>
        <span>过期时间</span>
        <strong>{{ expireText }}</strong>
      </p>
    </div>

    <label class="parse-field">
      <span>解析二维码</span>
      <div class="url-row">
        <input
          :value="parseInput"
          maxlength="300"
          placeholder="粘贴二维码链接或 Token"
          @input="handleParseInput"
        />
        <button
          type="button"
          class="action-btn action-btn--primary"
          :disabled="!parseInput.trim() || props.parsing"
          @click="handleParse"
        >
          {{ props.parsing ? '解析中...' : '解析并搜索' }}
        </button>
      </div>
    </label>

    <p v-if="copyMessage" class="message">{{ copyMessage }}</p>
    <p v-if="props.message" class="message">{{ props.message }}</p>
    <p v-if="copyError" class="error">{{ copyError }}</p>
    <p v-if="props.errorMessage" class="error">{{ props.errorMessage }}</p>
  </section>
</template>

<style scoped>
.qrcode-card {
  border: 1px solid var(--c-border);
  border-radius: 14px;
  background: #fff;
  padding: 14px;
  box-shadow: var(--shadow-1);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.card-header h3 {
  margin: 0;
  font-size: 14px;
  color: var(--c-text-main);
}

.hint {
  margin: 8px 0 0;
  color: var(--c-text-muted);
  font-size: 12px;
}

.qrcode-url-wrap {
  margin-top: 10px;
  display: grid;
  gap: 6px;
}

.qrcode-url-wrap label,
.parse-field span {
  font-size: 12px;
  color: var(--c-text-sub);
}

.url-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.url-row input {
  width: 100%;
  border: 1px solid var(--c-border);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  color: var(--c-text-main);
  outline: none;
}

.url-row input:focus {
  border-color: var(--c-primary);
}

.meta-grid {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.meta-grid p {
  margin: 0;
  padding: 8px 10px;
  border: 1px solid var(--c-border);
  border-radius: 10px;
  background: #fafbfc;
}

.meta-grid span {
  display: block;
  color: var(--c-text-muted);
  font-size: 11px;
}

.meta-grid strong {
  display: block;
  margin-top: 4px;
  color: var(--c-text-main);
  font-size: 12px;
  font-weight: 600;
  word-break: break-all;
}

.parse-field {
  margin-top: 10px;
  display: grid;
  gap: 6px;
}

.action-btn {
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 7px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease-out;
}

.action-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.action-btn--primary {
  color: #fff;
  background: var(--c-primary);
}

.action-btn--primary:hover:not(:disabled) {
  background: var(--c-primary-hover);
}

.action-btn--ghost {
  color: var(--c-text-sub);
  background: #fff;
  border-color: var(--c-border);
}

.action-btn--ghost:hover:not(:disabled) {
  border-color: #c7ced7;
}

.message {
  margin: 8px 0 0;
  color: var(--c-primary);
  font-size: 12px;
}

.error {
  margin: 8px 0 0;
  color: var(--c-danger);
  font-size: 12px;
}

@media (max-width: 1199px) {
  .meta-grid {
    grid-template-columns: 1fr;
  }

  .url-row {
    grid-template-columns: 1fr;
  }
}
</style>
