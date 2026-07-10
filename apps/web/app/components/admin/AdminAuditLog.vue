<script setup lang="ts">
import { computed, ref } from 'vue'
import AdminAsyncMessage from '~/components/admin/AdminAsyncMessage.vue'
import AdminHeaderBar from '~/components/admin/AdminHeaderBar.vue'
import AdminPagination from '~/components/admin/AdminPagination.vue'
import AdminTableShell from '~/components/admin/AdminTableShell.vue'
import { useAdminAuditLogs } from '~/composables/useAdminAuditLogs'
import { formatAuditDiff } from '~/utils/formatAuditDiff'
import { formatRelativeAdminTimestamp } from '~/utils/relativeAdminTimestamp'

const page = ref(1)
const auditLogsQuery = useAdminAuditLogs(page)

const entries = computed(() => auditLogsQuery.data.value?.data ?? [])
const meta = computed(() => auditLogsQuery.data.value?.meta)
const isLoading = computed(() => auditLogsQuery.isLoading.value)
const isError = computed(() => auditLogsQuery.isError.value)

function formatTimestamp(createdAt: string): string {
  return formatRelativeAdminTimestamp(createdAt, new Date(), 'clock')
}

function beforeLabel(before: Record<string, unknown> | null): string {
  return formatAuditDiff(before, null).before
}

function afterLabel(after: Record<string, unknown> | null): string {
  return formatAuditDiff(null, after).after
}
</script>

<template>
  <section data-testid="admin-audit-log-page" class="flex flex-col gap-6">
    <AdminHeaderBar title="Audit Log" />

    <AdminAsyncMessage
      v-if="isLoading"
      kind="loading"
      message="Loading audit log…"
      data-testid="admin-audit-log-loading"
    />
    <AdminAsyncMessage
      v-else-if="isError"
      kind="error"
      message="Could not load the audit log. Please try again."
      data-testid="admin-audit-log-error"
      @retry="auditLogsQuery.refetch()"
    />

    <template v-else>
      <div
        data-testid="admin-audit-log-caption"
        class="flex items-center gap-2 text-slate-500 text-xs"
      >
        <span>Append-only · read-only</span>
        <span class="size-1 rounded-full bg-slate-600" />
        <span>★ = privileged action</span>
      </div>

      <AdminTableShell>
        <table class="w-full border-collapse text-left text-sm">
          <thead>
            <tr class="border-readion-background-surface border-b text-slate-400">
              <th class="px-3 py-2 font-medium">Timestamp</th>
              <th class="px-3 py-2 font-medium">Actor</th>
              <th class="px-3 py-2 font-medium">Action</th>
              <th class="px-3 py-2 font-medium">Target</th>
              <th class="px-3 py-2 font-medium">Before</th>
              <th class="px-3 py-2 font-medium">After</th>
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
              <td data-testid="audit-timestamp" class="px-3 py-3 font-mono text-slate-400 text-xs">
                {{ formatTimestamp(entry.createdAt) }}
              </td>
              <td
                data-testid="audit-actor"
                class="px-3 py-3 text-slate-300"
                :class="entry.actorEmail === null ? 'text-slate-500 italic' : ''"
              >
                {{ entry.actorEmail ?? 'System' }}
              </td>
              <td data-testid="audit-action" class="px-3 py-3 font-medium text-slate-100">
                {{ entry.action }}
              </td>
              <td data-testid="audit-target" class="px-3 py-3 text-slate-300">
                {{ entry.targetLabel }}
              </td>
              <td data-testid="audit-before" class="px-3 py-3 font-mono text-slate-500 text-xs">
                {{ beforeLabel(entry.before) }}
              </td>
              <td data-testid="audit-after" class="px-3 py-3 font-mono text-slate-400 text-xs">
                {{ afterLabel(entry.after) }}
              </td>
            </tr>
          </tbody>
        </table>
      </AdminTableShell>

      <AdminPagination
        v-if="meta"
        testid="admin-audit-log-pagination"
        :page="page"
        :limit="meta.limit"
        :total="meta.total"
        @update:page="page = $event"
      />
    </template>
  </section>
</template>
