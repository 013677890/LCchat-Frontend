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
    </main>
  </section>
</template>

<style scoped>
.detail-pane {
  flex: 1;
  min-width: 0;
  background:
    radial-gradient(420px 220px at 0% 0%, rgba(8, 182, 98, 0.08), transparent 70%),
    linear-gradient(180deg, #f6faf8 0%, #f1f6f3 100%);
  display: flex;
  flex-direction: column;
}

.header {
  min-height: 76px;
  border-bottom: 1px solid var(--c-border);
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 14px 20px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(4px);
  gap: 10px;
}

.header-main {
  display: grid;
  gap: 4px;
}

.header h2 {
  margin: 0;
  font-size: 17px;
  color: var(--c-text-main);
}

.header p {
  margin: 0;
  color: var(--c-text-muted);
  font-size: 11px;
}

.body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.detail-card {
  background: #fff;
  border: 1px solid var(--c-border);
  border-radius: 16px;
  padding: 16px;
  box-shadow: var(--shadow-1);
}

.actions {
  margin-top: 14px;
  border: 1px solid var(--c-border);
  border-radius: 16px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: var(--shadow-1);
}

dl {
  margin: 0;
  display: grid;
  grid-template-columns: 132px 1fr;
  row-gap: 10px;
  column-gap: 12px;
}

dt {
  color: var(--c-text-muted);
  font-size: 13px;
}

dd {
  margin: 0;
  color: var(--c-text-main);
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
}

.empty {
  margin: 0;
  color: var(--c-text-muted);
  font-size: 13px;
}
</style>
