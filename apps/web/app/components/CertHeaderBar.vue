<script setup lang="ts">
import ReadionButton from '~/components/ReadionButton.vue'

defineProps<{
  name: string
  provider: string
  code: string
  isStartingSession: boolean
  isStartingMockExam: boolean
  sessionError?: string | null
  mockExamError?: string | null
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
      <div class="flex flex-shrink-0 flex-col items-end gap-2">
        <div class="flex gap-2">
        <ReadionButton
          data-testid="cert-header-mock-exam"
          variant="secondary"
          busy-label="Starting…"
          :busy="isStartingMockExam"
          @click="$emit('start-mock-exam')"
        >
          Mock exam
        </ReadionButton>
        <ReadionButton
          data-testid="cert-header-start-session"
          busy-label="Starting…"
          :busy="isStartingSession"
          @click="$emit('start-session')"
        >
          Start session →
        </ReadionButton>
        </div>
        <p
          v-if="sessionError || mockExamError"
          class="max-w-xs text-right text-readion-status-poor text-xs"
          role="alert"
        >
          {{ sessionError ?? mockExamError }}
        </p>
      </div>
    </div>
  </header>
</template>
