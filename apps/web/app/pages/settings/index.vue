<script setup lang="ts">
import AccountTab from '~/components/AccountTab.vue'
import SettingsLayout from '~/components/SettingsLayout.vue'
import StudyDefaultsTab from '~/components/StudyDefaultsTab.vue'
</script>

<template>
  <SettingsLayout>
    <template #account>
      <AccountTab />
    </template>
    <template #study-defaults>
      <StudyDefaultsTab />
    </template>
    <template #notifications>
      <p class="text-slate-400 text-sm">Notification settings</p>
    </template>
  </SettingsLayout>
</template>
