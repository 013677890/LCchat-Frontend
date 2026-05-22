<script setup lang="ts">
defineProps<{
  count?: number
  type?: 'chat' | 'contact'
}>()
</script>

<template>
  <div class="skeleton-container">
    <div
      v-for="i in (count || 5)"
      :key="i"
      class="skeleton-item"
      :class="[type ? `skeleton-item--${type}` : '']"
    >
      <!-- Avatar Shimmer -->
      <div class="skeleton-avatar"></div>

      <!-- Content Shimmer -->
      <div class="skeleton-content">
        <div class="skeleton-line skeleton-title"></div>
        <div class="skeleton-line skeleton-subtitle"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.skeleton-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  width: 100%;
}

.skeleton-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  position: relative;
  overflow: hidden;
}

/* Glassmorphic shimmering effect */
.skeleton-item::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  transform: translateX(-100%);
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.4) 20%,
    rgba(255, 255, 255, 0.7) 60%,
    rgba(255, 255, 255, 0) 100%
  );
  animation: shimmer 1.6s infinite ease-in-out;
}

@keyframes shimmer {
  100% {
    transform: translateX(100%);
  }
}

.skeleton-avatar {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.6);
  flex-shrink: 0;
}

.skeleton-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-line {
  height: 12px;
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.6);
}

.skeleton-title {
  width: 45%;
  height: 14px;
}

.skeleton-subtitle {
  width: 75%;
  height: 10px;
}

/* Chat view specific tweak */
.skeleton-item--chat {
  background: rgba(255, 255, 255, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.skeleton-item--chat .skeleton-avatar {
  background: rgba(255, 255, 255, 0.4);
}

.skeleton-item--chat .skeleton-line {
  background: rgba(255, 255, 255, 0.4);
}
</style>
