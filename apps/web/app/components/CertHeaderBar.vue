<script setup lang="ts">
defineProps<{
  name: string
  provider: string
  code: string
  isStartingSession: boolean
  isStartingMockExam: boolean
}>()

defineEmits<{
  (event: 'start-session'): void
  (event: 'start-mock-exam'): void
}>()
</script>

<template>
  <header
    data-testid="cert-header-bar"
    class="-mx-4 -mt-8 border-readion-background-surface border-b bg-readion-background-surface/30 px-4 py-4 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10"
  >
    <nav aria-label="Breadcrumb" class="mb-2 flex items-center gap-1.5 text-[11px]">
      <NuxtLink to="/" class="text-slate-400 hover:text-slate-200">← Dashboard</NuxtLink>
      <template v-if="code">
        <span class="text-slate-600">/</span>
        <span class="text-slate-400">{{ code }}</span>
      </template>
    </nav>
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <h1 data-testid="cert-detail-name" class="font-semibold text-slate-100 text-xl">
            {{ name }}
          </h1>
          <span
            v-if="code"
            class="rounded bg-readion-background-elevated px-1.5 py-0.5 font-mono text-[10px] text-slate-500"
          >
            {{ code }}
          </span>
        </div>
        <p data-testid="cert-detail-provider" class="text-slate-400 text-xs">{{ provider }}</p>
      </div>
      <div class="flex flex-shrink-0 gap-2">
        <button
          type="button"
          data-testid="cert-header-mock-exam"
          :disabled="isStartingMockExam"
          class="rounded-md border border-readion-background-surface px-3.5 py-1.5 text-slate-300 text-sm transition-colors hover:text-slate-100 disabled:opacity-50"
          @click="$emit('start-mock-exam')"
        >
          Mock exam
        </button>
        <button
          type="button"
          data-testid="cert-header-start-session"
          :disabled="isStartingSession"
          class="rounded-md bg-readion-primary px-4 py-1.5 font-medium text-sm text-white disabled:opacity-50"
          @click="$emit('start-session')"
        >
          Start session →
        </button>
      </div>
    </div>
  </header>
</template>
