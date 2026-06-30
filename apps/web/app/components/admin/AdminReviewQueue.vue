<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { ReadionProblemDetailsError } from '~/api/mutator'
import { adminQueryKeys } from '~/composables/adminQueryKeys'
import { useAdminQuarantine } from '~/composables/useAdminQuarantine'
import {
  quarantineAdminControllerApprove,
  quarantineAdminControllerReject,
} from '~~/src/api/quarantine-admin/quarantine-admin'

const queryClient = useQueryClient()
const quarantineQuery = useAdminQuarantine()

const items = computed(() => quarantineQuery.data.value?.data ?? [])
const isLoading = computed(() => quarantineQuery.isLoading.value)
const isError = computed(() => quarantineQuery.isError.value)

const actionError = ref<string | null>(null)
const pendingId = ref<string | null>(null)

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

function formatDate(createdAt: string): string {
  return dateFormatter.format(new Date(createdAt))
}

function provenanceChunks(sourceChunkIds: string[]): string {
  return sourceChunkIds.join(', ')
}

async function resolve(
  id: string,
  action: typeof quarantineAdminControllerApprove | typeof quarantineAdminControllerReject,
) {
  actionError.value = null
  pendingId.value = id
  try {
    await action(id)
    await queryClient.invalidateQueries({ queryKey: adminQueryKeys.quarantine() })
  } catch (error) {
    if (error instanceof ReadionProblemDetailsError && error.status === 409) {
      actionError.value = error.detail ?? error.title
    }
  } finally {
    pendingId.value = null
  }
}

function approve(id: string) {
  return resolve(id, quarantineAdminControllerApprove)
}

function reject(id: string) {
  return resolve(id, quarantineAdminControllerReject)
}
</script>

<template>
  <section data-testid="admin-review-queue-page" class="flex flex-col gap-6">
    <h1 class="font-semibold text-lg text-white">Review queue</h1>

    <p v-if="isLoading" data-testid="admin-review-queue-loading" class="text-slate-400 text-sm">
      Loading quarantined items…
    </p>
    <p v-else-if="isError" data-testid="admin-review-queue-error" class="text-red-400 text-sm">
      Could not load the review queue. Please try again.
    </p>

    <template v-else>
      <p
        v-if="actionError"
        data-testid="review-queue-error-banner"
        class="text-red-400 text-sm"
      >
        {{ actionError }}
      </p>

      <div
        v-if="items.length === 0"
        data-testid="review-queue-empty"
        class="rounded-lg border border-readion-background-surface border-dashed bg-readion-background-surface/40 px-6 py-10 text-center text-slate-400 text-sm"
      >
        No quarantined items are awaiting review.
      </div>

      <ul v-else class="flex flex-col gap-3">
        <li
          v-for="item in items"
          :key="item.id"
          data-testid="review-queue-item"
          :data-item-id="item.id"
          class="flex flex-col gap-3 rounded-lg border border-readion-background-surface/60 bg-readion-background-surface/40 px-5 py-4"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex flex-col gap-1">
              <span class="font-medium text-slate-100 text-sm">{{ item.domain }}</span>
              <span data-testid="review-queue-reason" class="text-slate-300 text-sm">
                {{ item.reason }}
              </span>
            </div>
            <span class="text-slate-500 text-xs">{{ formatDate(item.createdAt) }}</span>
          </div>

          <dl class="flex flex-col gap-1 text-xs">
            <div class="flex gap-2">
              <dt class="text-slate-500">Verdict</dt>
              <dd data-testid="review-queue-verdict" class="break-all text-slate-300">
                {{ item.verdict }}
              </dd>
            </div>
            <div class="flex gap-2">
              <dt class="text-slate-500">Provenance</dt>
              <dd data-testid="review-queue-provenance" class="break-all text-slate-300">
                {{ provenanceChunks(item.provenance.sourceChunkIds) }}
              </dd>
            </div>
          </dl>

          <div class="flex gap-2">
            <button
              type="button"
              data-testid="approve-item-btn"
              :disabled="pendingId === item.id"
              class="rounded-md border border-readion-background-surface px-3 py-1.5 font-medium text-slate-100 text-xs transition-colors hover:bg-readion-background-surface disabled:opacity-50"
              @click="approve(item.id)"
            >
              Approve
            </button>
            <button
              type="button"
              data-testid="reject-item-btn"
              :disabled="pendingId === item.id"
              class="rounded-md border border-readion-background-surface px-3 py-1.5 font-medium text-slate-100 text-xs transition-colors hover:bg-readion-background-surface disabled:opacity-50"
              @click="reject(item.id)"
            >
              Reject
            </button>
          </div>
        </li>
      </ul>
    </template>
  </section>
</template>
