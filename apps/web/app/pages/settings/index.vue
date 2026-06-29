<script setup lang="ts">
import AccountTab from '~/components/AccountTab.vue'
import NotificationsTab from '~/components/NotificationsTab.vue'
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
      <NotificationsTab />
    </template>
  </SettingsLayout>
</template>
