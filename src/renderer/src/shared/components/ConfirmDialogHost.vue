<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { AlertTriangle, HelpCircle } from 'lucide-vue-next'
import { useConfirmDialogState } from '../composables/useConfirm'

const { state, confirm, cancel } = useConfirmDialogState()

const inputRef = ref<HTMLInputElement | null>(null)
const confirmBtnRef = ref<HTMLButtonElement | null>(null)

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    cancel()
    return
  }
  // Enter 快捷确认；焦点在按钮上时交给原生 click，避免焦点在"取消"上却触发确认
  if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
    event.preventDefault()
    confirm()
  }
}

watch(
  () => state.open,
  async open => {
    if (open) {
      window.addEventListener('keydown', handleKeydown)
      await nextTick()
      if (state.withInput) {
        inputRef.value?.focus()
      } else {
        confirmBtnRef.value?.focus()
      }
    } else {
      window.removeEventListener('keydown', handleKeydown)
    }
  }
)

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <teleport to="body">
    <transition name="dialog-fade">
      <div v-if="state.open" class="dialog-mask" @click.self="cancel">
        <div class="dialog-card" role="alertdialog" :aria-label="state.title">
          <div class="dialog-icon" :class="{ 'dialog-icon--danger': state.danger }">
            <AlertTriangle v-if="state.danger" :size="22" />
            <HelpCircle v-else :size="22" />
          </div>
          <h3 class="dialog-title">{{ state.title }}</h3>
          <p class="dialog-message">{{ state.message }}</p>
          <input
            v-if="state.withInput"
            ref="inputRef"
            v-model="state.inputValue"
            type="text"
            class="dialog-input"
            :placeholder="state.placeholder"
            maxlength="100"
          />
          <div class="dialog-actions">
            <button type="button" class="dialog-btn dialog-btn--cancel" @click="cancel">
              {{ state.cancelText }}
            </button>
            <button
              ref="confirmBtnRef"
              type="button"
              class="dialog-btn dialog-btn--confirm"
              :class="{ 'dialog-btn--danger': state.danger }"
              @click="confirm"
            >
              {{ state.confirmText }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<style scoped>
.dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.dialog-card {
  width: 90%;
  max-width: 360px;
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: var(--radius-xl);
  padding: clamp(20px, 5vw, 24px);
  box-shadow: 0 24px 60px -12px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.dialog-icon {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  background: rgba(0, 198, 112, 0.12);
  color: var(--c-primary, #00c670);
  margin-bottom: 14px;
}

.dialog-icon--danger {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
}

.dialog-title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
}

.dialog-message {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #64748b;
  white-space: pre-line;
}

.dialog-input {
  width: 100%;
  margin-top: 16px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  padding: 9px 12px;
  font-size: 13px;
  color: #1e293b;
  background: rgba(0, 0, 0, 0.02);
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.dialog-input:focus {
  border-color: var(--c-primary, #00c670);
  box-shadow: 0 0 0 3px rgba(0, 198, 112, 0.12);
  background: #fff;
}

.dialog-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  width: 100%;
  margin-top: 20px;
}

.dialog-btn {
  border: none;
  border-radius: 12px;
  padding: 10px 0;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.dialog-btn--cancel {
  background: rgba(0, 0, 0, 0.05);
  color: #475569;
}

.dialog-btn--cancel:hover {
  background: rgba(0, 0, 0, 0.09);
}

.dialog-btn--confirm {
  background: linear-gradient(135deg, #00e583 0%, #00b164 100%);
  color: #fff;
  box-shadow: 0 4px 14px rgba(0, 198, 112, 0.35);
}

.dialog-btn--confirm:hover {
  filter: brightness(1.05);
  transform: translateY(-1px);
}

.dialog-btn--danger {
  background: linear-gradient(135deg, #f87171 0%, #dc2626 100%);
  box-shadow: 0 4px 14px rgba(220, 38, 38, 0.35);
}

.dialog-btn:focus-visible {
  outline: 3px solid var(--c-primary);
  outline-offset: 2px;
}

/* 进出场动画：遮罩淡入 + 卡片上浮缩放 */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.18s ease;
}

.dialog-fade-enter-active .dialog-card,
.dialog-fade-leave-active .dialog-card {
  transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.18s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-fade-enter-from .dialog-card {
  transform: scale(0.92) translateY(10px);
  opacity: 0;
}

.dialog-fade-leave-to .dialog-card {
  transform: scale(0.97);
  opacity: 0;
}
</style>
