<script lang="ts">
export type SettingsTabId = 'account' | 'study-defaults' | 'notifications'

interface SettingsTab {
  id: SettingsTabId
  label: string
}

const TABS: readonly SettingsTab[] = [
  { id: 'account', label: 'Account' },
  { id: 'study-defaults', label: 'Study defaults' },
  { id: 'notifications', label: 'Notifications' },
]
</script>

<script setup lang="ts">
defineProps<{ active: SettingsTabId }>()
defineEmits<{ select: [id: SettingsTabId] }>()
</script>

<template>
  <div
    role="tablist"
    class="flex border-readion-border-strong border-b px-2"
  >
    <button
      v-for="tab in TABS"
      :key="tab.id"
      :data-testid="`settings-tab-${tab.id}`"
      type="button"
      role="tab"
      :aria-selected="active === tab.id ? 'true' : 'false'"
      class="-mb-px border-b-2 px-4 py-3 font-medium text-sm transition-colors"
      :class="
        active === tab.id
          ? 'border-readion-accent-label text-white'
          : 'border-transparent text-slate-400 hover:text-slate-200'
      "
      @click="$emit('select', tab.id)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>
