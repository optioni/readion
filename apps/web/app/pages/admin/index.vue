<script setup lang="ts">
import AdminConsole from '~/components/admin/AdminConsole.vue'

definePageMeta({ middleware: 'admin', layout: 'admin' })
</script>

<template>
  <AdminConsole>
    <section data-testid="admin-certifications-page">
      <h1 class="font-semibold text-lg text-white">Certifications</h1>
    </section>
  </AdminConsole>
</template>
