<script setup lang="ts">
import AdminAuditLog from '~/components/admin/AdminAuditLog.vue'
import AdminConsole from '~/components/admin/AdminConsole.vue'

definePageMeta({ middleware: 'admin', layout: 'admin' })
</script>

<template>
  <AdminConsole>
    <AdminAuditLog />
  </AdminConsole>
</template>
