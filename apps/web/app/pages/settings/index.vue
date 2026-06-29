<script setup lang="ts">
import SettingsLayout from '~/components/SettingsLayout.vue'
</script>

<template>
  <SettingsLayout>
    <template #account>
      <p class="text-slate-400 text-sm">Account settings</p>
    </template>
    <template #study-defaults>
      <p class="text-slate-400 text-sm">Study defaults</p>
    </template>
    <template #notifications>
      <p class="text-slate-400 text-sm">Notification settings</p>
    </template>
  </SettingsLayout>
</template>
