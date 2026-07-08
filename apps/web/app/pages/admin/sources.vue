<script setup lang="ts">
import AdminConsole from '~/components/admin/AdminConsole.vue'
import AdminSources from '~/components/admin/AdminSources.vue'

definePageMeta({ middleware: 'admin', layout: 'admin' })
</script>

<template>
  <AdminConsole>
    <AdminSources />
  </AdminConsole>
</template>
