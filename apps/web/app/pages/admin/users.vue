<script setup lang="ts">
import AdminConsole from '~/components/admin/AdminConsole.vue'
import AdminUsers from '~/components/admin/AdminUsers.vue'

definePageMeta({ middleware: 'admin' })
</script>

<template>
  <AdminConsole>
    <AdminUsers />
  </AdminConsole>
</template>
