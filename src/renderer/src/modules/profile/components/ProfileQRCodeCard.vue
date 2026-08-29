<script setup lang="ts">
import { computed, ref } from 'vue'
import { buildQRCodeDataUrl } from '../../../shared/utils/qr-renderer'
import { writeTextToClipboard } from '../../../shared/utils/clipboard'

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
const exportPending = ref(false)
const qrImageUrl = computed(() => {
  if (!props.qrCodeUrl) {
    return ''
  }
  try {
    return buildQRCodeDataUrl(props.qrCodeUrl, {
      size: 260,
      margin: 3,
      dark: '#111111',
      light: '#ffffff'
    })
  } catch {
    return ''
  }
})

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
    await writeTextToClipboard(props.qrCodeUrl)
    copyMessage.value = '二维码链接已复制。'
  } catch (error) {
    copyError.value = error instanceof Error ? error.message : '复制失败，请手动复制。'
  }
}

async function exportQRCodeImage(): Promise<void> {
  if (!qrImageUrl.value || exportPending.value) {
    return
  }

  emit('clearFeedback')
  clearLocalCopyFeedback()
  exportPending.value = true
  try {
    const response = await fetch(qrImageUrl.value)
    if (!response.ok) {
      throw new Error(`导出失败（${response.status}）`)
    }
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = objectUrl
    link.download = `lcchat-qrcode-${Date.now()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(objectUrl)
    copyMessage.value = '二维码图片已导出。'
  } catch (error) {
    copyError.value = error instanceof Error ? error.message : '导出失败，请重试。'
  } finally {
    exportPending.value = false
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

    <section class="preview-wrap" aria-label="qrcode-preview">
      <div class="preview-box">
        <img v-if="qrImageUrl" :src="qrImageUrl" alt="我的二维码" />
        <p v-else class="preview-empty">暂无二维码，点击“刷新二维码”获取。</p>
      </div>
      <p class="preview-caption">二维码由前端本地生成，可直接导出图片分享。</p>
    </section>

    <div class="qrcode-url-wrap">
      <label>二维码链接</label>
      <div class="url-row">
        <input :value="props.qrCodeUrl || '-'" readonly />
        <div class="url-actions">
          <button
            type="button"
            class="action-btn action-btn--ghost"
            :disabled="!props.qrCodeUrl"
            @click="copyQRCodeUrl"
          >
            复制
          </button>
          <button
            type="button"
            class="action-btn action-btn--ghost"
            :disabled="!qrImageUrl || exportPending"
            @click="exportQRCodeImage"
          >
            {{ exportPending ? '导出中...' : '导出图片' }}
          </button>
        </div>
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
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: var(--radius-xl);
  background: var(--c-bg-panel-solid);
  padding: 24px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.card-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--c-text-main);
}

.hint {
  margin: 8px 0 0;
  color: var(--c-text-sub);
  font-size: 13px;
}

.preview-wrap {
  margin-top: 20px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: var(--radius-lg);
  background: #ffffff;
  padding: 20px;
}

.preview-box {
  width: min(100%, 280px);
  aspect-ratio: 1;
  margin: 0 auto;
  border-radius: var(--radius-md);
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  display: grid;
  place-items: center;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  padding: 16px;
}

.preview-box img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.preview-empty {
  margin: 0;
  padding: 0 20px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--c-text-muted);
  text-align: center;
}

.preview-caption {
  margin: 16px 0 0;
  color: var(--c-text-sub);
  font-size: 12px;
  text-align: center;
}

.qrcode-url-wrap {
  margin-top: 24px;
  display: grid;
  gap: 8px;
}

.qrcode-url-wrap label,
.parse-field span {
  font-size: 13px;
  font-weight: 600;
  color: var(--c-text-main);
  margin-left: 2px;
}

.url-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
}

.url-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.url-row input {
  width: 100%;
  border: 1.5px solid transparent;
  border-radius: var(--radius-md);
  padding: 10px 14px;
  font-size: 13px;
  color: var(--c-text-main);
  background: rgba(0, 0, 0, 0.03);
  outline: none;
  transition: all 0.2s ease;
}

.url-row input:focus {
  background: #fff;
  border-color: var(--c-primary);
  box-shadow: 0 0 0 4px var(--c-primary-soft);
}

.meta-grid {
  margin-top: 16px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.meta-grid p {
  margin: 0;
  padding: 12px 14px;
  border: 1px solid rgba(0, 0, 0, 0.04);
  border-radius: var(--radius-md);
  background: rgba(0, 0, 0, 0.02);
}

.meta-grid span {
  display: block;
  color: var(--c-text-sub);
  font-size: 12px;
  font-weight: 500;
}

.meta-grid strong {
  display: block;
  margin-top: 6px;
  color: var(--c-text-main);
  font-size: 13px;
  font-weight: 600;
  word-break: break-all;
}

.parse-field {
  margin-top: 24px;
  display: grid;
  gap: 8px;
}

.action-btn {
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.action-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.action-btn--primary {
  color: #fff;
  background: var(--c-primary);
  box-shadow: 0 4px 10px rgba(0, 198, 112, 0.3);
}

.action-btn--primary:hover:not(:disabled) {
  background: var(--c-primary-hover);
  transform: translateY(-2px);
  box-shadow: 0 6px 14px rgba(0, 198, 112, 0.4);
}

.action-btn--ghost {
  color: var(--c-text-sub);
  background: #fff;
  border-color: var(--c-border);
}

.action-btn--ghost:hover:not(:disabled) {
  border-color: var(--c-text-main);
  color: var(--c-text-main);
  transform: translateY(-1px);
}

.message {
  margin: 12px 0 0;
  color: var(--c-primary);
  font-size: 13px;
}

.error {
  margin: 12px 0 0;
  color: var(--c-danger);
  font-size: 13px;
}

@media (max-width: 1199px) {
  .meta-grid {
    grid-template-columns: 1fr;
  }

  .url-row {
    grid-template-columns: 1fr;
  }

  .url-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}
</style>
