<script setup lang="ts">
import { useReadionColorMode } from '~/composables/useReadionColorMode'

const _colorMode = useReadionColorMode()
</script>

<template>
  <button
    type="button"
    class="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 text-sm"
    :aria-label="
      _colorMode.preference.value === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
    "
    @click="_colorMode.toggle"
  >
    {{ _colorMode.preference.value === 'dark' ? 'Dark' : 'Light' }}
  </button>
</template>
