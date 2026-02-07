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
      <h2>{{ props.title }}</h2>
      <p v-if="props.description">{{ props.description }}</p>
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
  background: linear-gradient(180deg, #f7f8f9 0%, #f2f3f5 100%);
  display: flex;
  flex-direction: column;
}

.header {
  height: 64px;
  border-bottom: 1px solid var(--c-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: #fff;
  gap: 10px;
}

.header h2 {
  margin: 0;
  font-size: 16px;
  color: var(--c-text-main);
}

.header p {
  margin: 0;
  color: var(--c-text-muted);
  font-size: 12px;
}

.body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.detail-card {
  background: #fff;
  border: 1px solid var(--c-border);
  border-radius: 14px;
  padding: 16px;
  box-shadow: var(--shadow-1);
}

.actions {
  margin-top: 14px;
}

dl {
  margin: 0;
  display: grid;
  grid-template-columns: 128px 1fr;
  row-gap: 12px;
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
