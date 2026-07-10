<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <header
    data-testid="admin-header-bar"
    class="flex flex-wrap items-center justify-between gap-4 border-readion-border-strong border-b bg-readion-background-elevated px-7 py-4"
  >
    <div>
      <h1 data-testid="admin-header-bar-title" class="font-semibold text-lg text-readion-text-primary">
        {{ title }}
      </h1>
      <p
        v-if="subtitle"
        data-testid="admin-header-bar-subtitle"
        class="mt-0.5 text-readion-text-muted text-xs"
      >
        {{ subtitle }}
      </p>
    </div>
    <div class="flex items-center gap-3">
      <slot />
    </div>
  </header>
</template>
