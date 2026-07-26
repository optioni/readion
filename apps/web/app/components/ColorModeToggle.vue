<script setup lang="ts">
import ReadionButton from '~/components/ReadionButton.vue'
import { useReadionColorMode } from '~/composables/useReadionColorMode'

const _colorMode = useReadionColorMode()
</script>

<template>
  <ReadionButton
    data-testid="color-mode-toggle"
    variant="secondary"
    class="min-h-7 rounded-md px-2 py-1 text-xs"
    :aria-label="
      _colorMode.preference.value === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
    "
    @click="_colorMode.toggle"
  >
    {{ _colorMode.preference.value === 'dark' ? 'Dark' : 'Light' }}
  </ReadionButton>
</template>
