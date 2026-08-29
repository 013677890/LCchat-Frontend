<script setup lang="ts">
import { ref } from 'vue'
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogClose,
} from 'radix-vue'
import { X } from 'lucide-vue-next'
import ProfileEditorCard from './ProfileEditorCard.vue'
import ProfileQRCodeCard from './ProfileQRCodeCard.vue'

const props = defineProps<{
  open: boolean
  profile: any
  qrCodeUrl: string
  qrCodeToken: string
  qrCodeExpireAt: string
  saving?: boolean
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  'profileSubmit': [any]
  'profileUploadAvatar': [File]
  'refreshQrCode': []
}>()
</script>

<template>
  <DialogRoot :open="props.open" @update:open="emit('update:open', $event)">
    <DialogPortal>
      <DialogOverlay class="bg-black/60 fixed inset-0 z-50 backdrop-blur-md transition-all duration-300" />
      <DialogContent class="fixed top-[50%] left-[50%] max-h-[85vh] w-full max-w-[800px] translate-x-[-50%] translate-y-[-50%] rounded-[20px] bg-[var(--c-bg-app)] shadow-[0_12px_40px_rgba(0,0,0,0.2)] focus:outline-none z-50 overflow-y-auto flex flex-col sm:flex-row gap-6 p-6">
        <DialogClose class="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition-colors z-10 w-8 h-8 grid place-items-center rounded-full bg-white shadow-sm border border-gray-100">
          <X :size="18" stroke-width="2.5" />
        </DialogClose>
        
        <div class="flex-1 min-w-0">
          <ProfileEditorCard
            :profile="props.profile"
            :saving="props.saving"
            @submit="emit('profileSubmit', $event)"
            @upload-avatar="emit('profileUploadAvatar', $event)"
          />
        </div>
        <div class="w-full sm:w-[320px] flex-shrink-0">
          <ProfileQRCodeCard
            :qr-code-url="props.qrCodeUrl"
            :qr-code-token="props.qrCodeToken"
            :expire-at="props.qrCodeExpireAt"
            :loading="props.loading"
            @refresh="emit('refreshQrCode')"
          />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
