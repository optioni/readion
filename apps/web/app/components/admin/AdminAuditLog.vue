<script setup lang="ts">
import { computed, ref } from 'vue'
import AdminPagination from '~/components/admin/AdminPagination.vue'
import { useAdminAuditLogs } from '~/composables/useAdminAuditLogs'
import { formatAuditDiff } from '~/utils/formatAuditDiff'

const page = ref(1)
const auditLogsQuery = useAdminAuditLogs(page)

const entries = computed(() => auditLogsQuery.data.value?.data ?? [])
const meta = computed(() => auditLogsQuery.data.value?.meta)
const isLoading = computed(() => auditLogsQuery.isLoading.value)
const isError = computed(() => auditLogsQuery.isError.value)

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function formatTimestamp(createdAt: string): string {
  return dateFormatter.format(new Date(createdAt))
}

function formatChange(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): string {
  const diff = formatAuditDiff(before, after)
  return diff.before === '—' && diff.after === '—' ? '—' : `${diff.before} → ${diff.after}`
}
</script>

<template>
  <section data-testid="admin-audit-log-page" class="flex flex-col gap-6">
    <h1 class="font-semibold text-lg text-white">Audit Log</h1>

    <p v-if="isLoading" data-testid="admin-audit-log-loading" class="text-slate-400 text-sm">
      Loading audit log…
    </p>
    <p v-else-if="isError" data-testid="admin-audit-log-error" class="text-red-400 text-sm">
      Could not load the audit log. Please try again.
    </p>

    <table v-else class="w-full border-collapse text-left text-sm">
      <thead>
        <tr class="border-readion-background-surface border-b text-slate-400">
          <th class="px-3 py-2 font-medium">Action</th>
          <th class="px-3 py-2 font-medium">Target</th>
          <th class="px-3 py-2 font-medium">Change</th>
          <th class="px-3 py-2 font-medium">Actor</th>
          <th class="px-3 py-2 font-medium">When</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="entry in entries"
          :key="entry.id"
          data-testid="audit-log-row"
          :data-audit-id="entry.id"
          class="border-readion-background-surface/60 border-b"
        >
          <td data-testid="audit-action" class="px-3 py-3 font-medium text-slate-100">
            {{ entry.action }}
          </td>
          <td data-testid="audit-target" class="px-3 py-3 text-slate-300">
            {{ entry.targetLabel }}
          </td>
          <td data-testid="audit-change" class="px-3 py-3 font-mono text-slate-400 text-xs">
            {{ formatChange(entry.before, entry.after) }}
          </td>
          <td data-testid="audit-actor" class="px-3 py-3 text-slate-300">
            {{ entry.actorEmail ?? 'System' }}
          </td>
          <td data-testid="audit-timestamp" class="px-3 py-3 text-slate-300">
            {{ formatTimestamp(entry.createdAt) }}
          </td>
        </tr>
      </tbody>
    </table>

    <AdminPagination
      v-if="meta"
      testid="admin-audit-log-pagination"
      :page="page"
      :limit="meta.limit"
      :total="meta.total"
      @update:page="page = $event"
    />
  </section>
</template>
