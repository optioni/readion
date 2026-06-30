<template>
  <div class="flex min-h-screen bg-readion-background-base text-slate-100 antialiased">
    <AppSidebar />

    <main data-testid="shell-container" class="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-10">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import AppSidebar from '~/components/AppSidebar.vue'
</script>
