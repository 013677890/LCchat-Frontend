<script setup lang="ts"></script>

<template>
  <RouterView v-slot="{ Component, route }">
    <Transition name="lc-fade" mode="out-in" appear>
      <component :is="Component" :key="route.fullPath" />
    </Transition>
  </RouterView>
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
