<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { UpdateMyProfileRequest } from '../../../shared/types/user'

export interface ProfileEditorViewData {
  uuid: string
  email: string
  telephone: string
  avatar: string
  nickname: string
  gender: number
  birthday: string
  signature: string
}

const props = defineProps<{
  profile: ProfileEditorViewData | null
  saving?: boolean
  avatarUploading?: boolean
  errorMessage?: string
}>()

const emit = defineEmits<{
  submit: [UpdateMyProfileRequest]
  uploadAvatar: [file: File]
  clearError: []
}>()

const avatarInputRef = ref<HTMLInputElement | null>(null)
const nickname = ref('')
const gender = ref(3)
const birthday = ref('')
const signature = ref('')

watch(
  () => props.profile,
  (value) => {
    nickname.value = value?.nickname ?? ''
    gender.value =
      value?.gender === 1 || value?.gender === 2 || value?.gender === 3 ? value.gender : 3
    birthday.value = value?.birthday ?? ''
    signature.value = value?.signature ?? ''
  },
  { immediate: true }
)

const hasChanges = computed(() => {
  if (!props.profile) {
    return false
  }

  const initialGender =
    props.profile.gender === 1 || props.profile.gender === 2 || props.profile.gender === 3
      ? props.profile.gender
      : 3

  return (
    nickname.value.trim() !== props.profile.nickname ||
    signature.value.trim() !== props.profile.signature ||
    birthday.value !== props.profile.birthday ||
    gender.value !== initialGender
  )
})

function onFieldInput(): void {
  emit('clearError')
}

const avatarUrl = computed(() => props.profile?.avatar || '')
const avatarFallback = computed(() => {
  const name = props.profile?.nickname?.trim() || props.profile?.uuid || ''
  return name ? name.slice(0, 1).toUpperCase() : '?'
})

function triggerAvatarUpload(): void {
  if (!props.profile || props.avatarUploading) {
    return
  }

  emit('clearError')
  avatarInputRef.value?.click()
}

function handleAvatarFileChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) {
    return
  }

  emit('clearError')
  emit('uploadAvatar', file)
  input.value = ''
}

function handleSubmit(): void {
  if (!props.profile || !hasChanges.value) {
    return
  }

  emit('submit', {
    nickname: nickname.value.trim(),
    gender: gender.value,
    birthday: birthday.value,
    signature: signature.value.trim()
  })
}
</script>

<template>
  <section class="profile-editor">
    <header class="editor-header">
      <h3>个人资料</h3>
      <p>修改昵称、签名与基础信息，保存后将同步到服务端并回写本地缓存。</p>
    </header>

    <section class="avatar-section">
      <div class="avatar-preview" aria-hidden="true">
        <img v-if="avatarUrl" :src="avatarUrl" alt="avatar" />
        <span v-else>{{ avatarFallback }}</span>
      </div>
      <div class="avatar-meta">
        <strong>头像</strong>
        <small>仅支持 JPG/PNG，大小不超过 2MB。</small>
      </div>
      <input
        ref="avatarInputRef"
        class="avatar-input"
        type="file"
        accept="image/png,image/jpeg"
        @change="handleAvatarFileChange"
      />
      <button
        type="button"
        class="upload-btn"
        :disabled="!props.profile || props.avatarUploading"
        @click="triggerAvatarUpload"
      >
        {{ props.avatarUploading ? '上传中...' : '上传头像' }}
      </button>
    </section>

    <div class="meta-grid">
      <p>
        <span>用户 UUID</span><strong>{{ props.profile?.uuid || '-' }}</strong>
      </p>
      <p>
        <span>邮箱</span><strong>{{ props.profile?.email || '-' }}</strong>
      </p>
      <p>
        <span>手机号</span><strong>{{ props.profile?.telephone || '-' }}</strong>
      </p>
    </div>

    <div class="form-grid">
      <label class="field">
        <span>昵称</span>
        <input v-model="nickname" maxlength="20" placeholder="请输入昵称" @input="onFieldInput" />
      </label>

      <label class="field">
        <span>生日</span>
        <input v-model="birthday" type="date" @input="onFieldInput" />
      </label>

      <label class="field">
        <span>性别</span>
        <select v-model.number="gender" @change="onFieldInput">
          <option :value="1">男</option>
          <option :value="2">女</option>
          <option :value="3">未知</option>
        </select>
      </label>

      <label class="field field--full">
        <span>签名</span>
        <textarea
          v-model="signature"
          rows="3"
          maxlength="100"
          placeholder="介绍一下自己"
          @input="onFieldInput"
        />
      </label>
    </div>

    <p v-if="props.errorMessage" class="error">{{ props.errorMessage }}</p>

    <div class="actions">
      <button
        type="button"
        class="save-btn"
        :disabled="!hasChanges || props.saving"
        @click="handleSubmit"
      >
        {{ props.saving ? '保存中...' : '保存资料' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.profile-editor {
  border: 1px solid var(--c-border);
  border-radius: 14px;
  background: #fff;
  padding: 14px;
  box-shadow: var(--shadow-1);
}

.editor-header h3 {
  margin: 0;
  font-size: 14px;
  color: var(--c-text-main);
}

.editor-header p {
  margin: 6px 0 0;
  color: var(--c-text-muted);
  font-size: 12px;
}

.avatar-section {
  margin-top: 10px;
  border: 1px solid var(--c-border);
  border-radius: 12px;
  padding: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: #fafbfc;
}

.avatar-preview {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 1px solid var(--c-border);
  background: #eef1f4;
  display: grid;
  place-items: center;
  overflow: hidden;
  flex-shrink: 0;
}

.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-preview span {
  font-size: 20px;
  font-weight: 700;
  color: var(--c-text-sub);
}

.avatar-meta {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 4px;
}

.avatar-meta strong {
  color: var(--c-text-main);
  font-size: 13px;
}

.avatar-meta small {
  color: var(--c-text-muted);
  font-size: 11px;
  line-height: 1.4;
}

.avatar-input {
  display: none;
}

.upload-btn {
  border: 1px solid var(--c-border);
  border-radius: 8px;
  background: #fff;
  color: var(--c-text-sub);
  padding: 7px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease-out;
  flex-shrink: 0;
}

.upload-btn:hover:not(:disabled) {
  border-color: #c7ced7;
}

.upload-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.meta-grid {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
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

.form-grid {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.field {
  display: grid;
  gap: 6px;
}

.field span {
  font-size: 12px;
  color: var(--c-text-sub);
}

.field input,
.field select,
.field textarea {
  width: 100%;
  border: 1px solid var(--c-border);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  color: var(--c-text-main);
  background: #fff;
  outline: none;
}

.field input:focus,
.field select:focus,
.field textarea:focus {
  border-color: var(--c-primary);
}

.field--full {
  grid-column: 1 / -1;
}

.field textarea {
  resize: none;
}

.actions {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
}

.save-btn {
  border: none;
  border-radius: 8px;
  background: var(--c-primary);
  color: #fff;
  padding: 8px 14px;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.15s ease-out;
}

.save-btn:hover:not(:disabled) {
  background: var(--c-primary-hover);
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error {
  margin: 10px 0 0;
  color: var(--c-danger);
  font-size: 12px;
}

@media (max-width: 1199px) {
  .avatar-section {
    display: grid;
    grid-template-columns: 56px 1fr;
  }

  .upload-btn {
    grid-column: 1 / -1;
    justify-self: flex-start;
  }

  .meta-grid {
    grid-template-columns: 1fr;
  }
}
</style>
