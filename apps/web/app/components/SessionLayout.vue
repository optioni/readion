<script setup lang="ts">
import { ref } from 'vue'

const collapsed = ref(false)

function toggle() {
  collapsed.value = !collapsed.value
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col bg-readion-background-base">
    <slot name="header" />

    <div data-testid="session-split-panel" class="flex min-h-0 flex-1 overflow-hidden">
      <div
        data-testid="session-content"
        class="flex flex-1 flex-col gap-3.5 overflow-y-auto px-7 py-6"
      >
        <slot name="content" />
      </div>

      <aside
        data-testid="agent-panel"
        :data-collapsed="String(collapsed)"
        class="flex flex-shrink-0 flex-col border-readion-border-strong border-l bg-readion-background-elevated"
        :class="collapsed ? 'w-11' : 'w-80'"
      >
        <div class="flex items-center justify-between border-readion-border-strong border-b px-3 py-3">
          <span v-if="!collapsed" class="text-readion-text-primary text-sm">Study assistant</span>
          <button
            type="button"
            data-testid="agent-panel-toggle"
            :aria-label="collapsed ? 'Expand study assistant' : 'Collapse study assistant'"
            class="rounded-md p-1 text-readion-text-muted hover:text-slate-200"
            @click="toggle"
          >
            <span v-if="collapsed" aria-hidden="true">&#8592;</span>
            <span v-else aria-hidden="true">&#10005;</span>
          </button>
        </div>

        <div v-if="!collapsed" data-testid="agent-panel-body" class="flex min-h-0 flex-1 flex-col">
          <slot name="agent" />
        </div>
      </aside>
    </div>
  </div>
</template>
