<script setup lang="ts">
import AdminAuditLog from '~/components/admin/AdminAuditLog.vue'
import AdminConsole from '~/components/admin/AdminConsole.vue'

definePageMeta({ middleware: 'admin' })
</script>

<template>
  <AdminConsole>
    <AdminAuditLog />
  </AdminConsole>
</template>
