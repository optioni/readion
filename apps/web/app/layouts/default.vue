<template>
  <div class="flex min-h-screen bg-readion-background-base text-slate-100 antialiased">
    <AppSidebar :open="drawerOpen" @close="drawerOpen = false" />

    <div
      v-if="drawerOpen"
      data-testid="sidebar-drawer-backdrop"
      class="fixed inset-0 z-30 bg-black/60 lg:hidden"
      @click="drawerOpen = false"
    />

    <div class="flex min-w-0 flex-1 flex-col">
      <header
        class="flex h-13 flex-shrink-0 items-center gap-2 border-slate-700 border-b bg-readion-background-elevated px-4 lg:hidden"
      >
        <button
          data-testid="sidebar-drawer-toggle"
          type="button"
          aria-label="Open navigation"
          :aria-expanded="drawerOpen"
          class="flex h-8 w-8 items-center justify-center rounded-md text-slate-300 transition-colors hover:text-slate-100"
          @click="drawerOpen = true"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <span class="font-bold text-slate-100 text-sm tracking-tight">Readion</span>
      </header>

      <main data-testid="shell-container" class="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-10">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const drawerOpen = ref(false)
const route = useRoute()

// Dismiss the off-canvas drawer once a destination is chosen on narrow viewports.
watch(
  () => route.fullPath,
  () => {
    drawerOpen.value = false
  },
)
</script>
