<script setup lang="ts">
interface DetailLine {
  label: string
  value: string
}

const props = defineProps<{
  title: string
  description?: string
  lines?: DetailLine[]
  emptyText?: string
}>()
</script>

<template>
  <section class="detail-pane">
    <header class="header">
      <div class="header-main">
        <h2>{{ props.title }}</h2>
        <p v-if="props.description">{{ props.description }}</p>
      </div>
    </header>

    <main class="body">
      <div class="body-inner">
        <div v-if="(props.lines || []).length > 0" class="detail-card">
          <dl>
            <template v-for="line in props.lines" :key="line.label">
              <dt>{{ line.label }}</dt>
              <dd>{{ line.value || '-' }}</dd>
            </template>
          </dl>
        </div>
        <div v-if="$slots.actions" class="actions">
          <slot name="actions" />
        </div>
        <p v-else class="empty">{{ props.emptyText || '请选择一项查看详情' }}</p>
      </div>
    </main>
  </section>
</template>

<style scoped>
.detail-pane {
  flex: 1;
  min-width: 0;
  background: var(--c-bg-app);
  display: flex;
  flex-direction: column;
}

.header {
  min-height: 64px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: var(--blur-md);
  -webkit-backdrop-filter: var(--blur-md);
  gap: 12px;
  position: sticky;
  top: 0;
  z-index: 10;
}

.header-main {
  display: grid;
  gap: 4px;
}

.header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--c-text-main);
}

.header p {
  margin: 0;
  color: var(--c-text-sub);
  font-size: 12px;
}

.body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.body-inner {
  width: min(100%, 720px);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
  animation: slideUp 0.4s var(--ease-out) forwards;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(15px); }
  to { opacity: 1; transform: translateY(0); }
}

.detail-card {
  background: var(--c-bg-panel-solid);
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: var(--radius-xl);
  padding: 24px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
}

.actions {
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: var(--radius-xl);
  padding: 24px;
  background: var(--c-bg-panel-solid);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
}

dl {
  margin: 0;
  display: grid;
  grid-template-columns: 140px 1fr;
  row-gap: 16px;
  column-gap: 16px;
}

dt {
  color: var(--c-text-sub);
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
}

dd {
  margin: 0;
  color: var(--c-text-main);
  font-size: 15px;
  line-height: 1.6;
  word-break: break-word;
  background: rgba(0, 0, 0, 0.02);
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(0, 0, 0, 0.04);
}

.empty {
  margin: 0;
  text-align: center;
  color: var(--c-text-muted);
  font-size: 14px;
  padding-top: 40px;
}
</style>
