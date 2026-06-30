<script setup lang="ts">
import { useReadionColorMode } from '~/composables/useReadionColorMode'

const _colorMode = useReadionColorMode()
</script>

<template>
  <button
    type="button"
    class="rounded-md border border-slate-700 px-2 py-1 text-slate-400 text-xs transition-colors hover:text-slate-200"
    :aria-label="
      _colorMode.preference.value === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
    "
    @click="_colorMode.toggle"
  >
    {{ _colorMode.preference.value === 'dark' ? 'Dark' : 'Light' }}
  </button>
</template>
