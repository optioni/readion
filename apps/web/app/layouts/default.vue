<template>
  <div
    data-testid="app-shell"
    class="flex w-full max-w-full min-w-0 bg-readion-background-base text-readion-text-primary antialiased"
    :class="isFullBleed ? 'h-screen overflow-hidden' : 'min-h-screen'"
  >
    <AppSidebar :open="drawerOpen" @close="drawerOpen = false" />

    <div
      v-if="drawerOpen"
      data-testid="sidebar-drawer-backdrop"
      class="fixed inset-0 z-30 bg-readion-background-elevated/80 lg:hidden"
      @click="drawerOpen = false"
    />

    <div
      data-testid="shell-content-frame"
      class="flex w-full max-w-full min-w-0 flex-1 flex-col"
      :class="isFullBleed ? 'min-h-0' : ''"
    >
      <header
        class="flex h-13 flex-shrink-0 items-center gap-2 border-readion-border-strong border-b bg-readion-background-elevated px-4 lg:hidden"
      >
        <ReadionButton
          data-testid="sidebar-drawer-toggle"
          variant="icon"
          aria-label="Open navigation"
          :aria-expanded="drawerOpen"
          class="size-8 min-h-8 rounded-md"
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
        </ReadionButton>
        <span class="font-bold text-readion-text-primary text-sm tracking-tight">Readion</span>
      </header>

      <main
        data-testid="shell-container"
        class="w-full max-w-full min-w-0 flex-1 [overflow-wrap:anywhere]"
        :class="isFullBleed ? 'flex min-h-0 flex-col' : 'px-4 py-8 sm:px-6 lg:px-10'"
      >
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ReadionButton from '~/components/ReadionButton.vue'

const drawerOpen = ref(false)
const route = useRoute()

// Full-bleed pages (e.g. the session split panel) render their own internal header/scroll regions
// and must fill the viewport edge-to-edge instead of the standard padded, page-scrolling column.
const isFullBleed = computed(() => route.meta?.fullBleed === true)

// Dismiss the off-canvas drawer once a destination is chosen on narrow viewports.
watch(
  () => route.fullPath,
  () => {
    drawerOpen.value = false
  },
)
</script>
