<template>
  <UApp>
    <NuxtLayout :key="layoutKey" :name="route.meta.layout">
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// Key the layout by its resolved name so a change of layout (e.g. the auth/login shell giving way to
// the authenticated app shell after a client-side auth redirect) tears the previous layout subtree
// down instead of leaving it stranded in the DOM. Without the key, a production hydration mismatch
// can keep the server-rendered login layout mounted above the real app shell.
const route = useRoute()
const layoutKey = computed(() => String(route.meta.layout ?? 'default'))
</script>
