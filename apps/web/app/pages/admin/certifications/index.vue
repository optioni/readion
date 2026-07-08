<script setup lang="ts">
import AdminCertifications from '~/components/admin/AdminCertifications.vue'
import AdminConsole from '~/components/admin/AdminConsole.vue'

definePageMeta({ middleware: 'admin', layout: 'admin' })
</script>

<template>
  <AdminConsole>
    <AdminCertifications />
  </AdminConsole>
</template>
