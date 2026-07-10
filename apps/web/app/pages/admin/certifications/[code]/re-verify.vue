<script setup lang="ts">
import AdminCertReverify from '~/components/admin/AdminCertReverify.vue'
import AdminConsole from '~/components/admin/AdminConsole.vue'

definePageMeta({ middleware: 'admin', layout: 'admin' })

const route = useRoute()
const code = computed(() => String(route.params.code ?? ''))
</script>

<template>
  <AdminConsole>
    <AdminCertReverify :code="code" />
  </AdminConsole>
</template>
