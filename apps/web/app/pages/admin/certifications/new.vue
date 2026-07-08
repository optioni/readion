<script setup lang="ts">
import AdminConsole from '~/components/admin/AdminConsole.vue'
import CertSetupWizard from '~/components/admin/CertSetupWizard.vue'

definePageMeta({ middleware: 'admin', layout: 'admin' })
</script>

<template>
  <AdminConsole>
    <CertSetupWizard />
  </AdminConsole>
</template>
