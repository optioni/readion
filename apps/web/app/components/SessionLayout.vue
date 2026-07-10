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
        v-if="collapsed"
        data-testid="agent-panel"
        data-collapsed="true"
        class="flex w-11 flex-shrink-0 flex-col items-center gap-3 border-readion-border-strong border-l bg-readion-background-elevated py-4"
      >
        <button
          type="button"
          data-testid="agent-panel-toggle"
          aria-label="Expand study assistant"
          class="flex h-7 w-7 items-center justify-center rounded-md bg-readion-accent-label/10 text-readion-accent-label"
          @click="toggle"
        >
          <svg
            data-testid="agent-panel-collapsed-icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </button>
        <div class="h-full w-px bg-readion-border-strong" />
        <span
          data-testid="agent-panel-collapsed-label"
          class="text-[10px] text-readion-text-subtle uppercase tracking-wider"
          style="writing-mode: vertical-rl; transform: rotate(180deg)"
        >
          Ask AI
        </span>
      </aside>

      <aside
        v-else
        data-testid="agent-panel"
        data-collapsed="false"
        class="flex w-80 flex-shrink-0 flex-col border-readion-border-strong border-l bg-readion-background-elevated"
      >
        <div class="flex items-center justify-between border-readion-border-strong border-b px-3 py-3">
          <span class="flex items-center gap-1.5 text-readion-text-primary text-sm">
            Study assistant
            <span
              data-testid="agent-online-dot"
              class="h-1.5 w-1.5 rounded-full bg-readion-status-good"
            />
          </span>
          <button
            type="button"
            data-testid="agent-panel-toggle"
            aria-label="Collapse study assistant"
            class="rounded-md p-1 text-readion-text-muted hover:text-slate-200"
            @click="toggle"
          >
            <span aria-hidden="true">&#10005;</span>
          </button>
        </div>

        <div data-testid="agent-panel-body" class="flex min-h-0 flex-1 flex-col">
          <slot name="agent" />
        </div>
      </aside>
    </div>
  </div>
</template>
