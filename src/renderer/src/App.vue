<script setup lang="ts">
import { Toaster } from 'vue-sonner'
import ConfirmDialogHost from './shared/components/ConfirmDialogHost.vue'
</script>

<template>
  <RouterView v-slot="{ Component, route }">
    <Transition name="lc-fade" mode="out-in" appear>
      <component :is="Component" :key="route.fullPath" />
    </Transition>
  </RouterView>
  <Toaster position="bottom-right" expand richColors />
  <ConfirmDialogHost />
</template>

<style scoped>
.lc-fade-enter-active,
.lc-fade-leave-active {
  transition: opacity 0.18s ease-out;
}

.lc-fade-enter-from,
.lc-fade-leave-to {
  opacity: 0;
}
</style>
