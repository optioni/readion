<script setup lang="ts">
import AdminConsole from '~/components/admin/AdminConsole.vue'
import AdminReviewQueue from '~/components/admin/AdminReviewQueue.vue'

definePageMeta({ middleware: 'admin', layout: 'admin' })
</script>

<template>
  <AdminConsole>
    <AdminReviewQueue />
  </AdminConsole>
</template>
