<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { ReadionProblemDetailsError } from '~/api/mutator'
import AdminReviewQueueDetail from '~/components/admin/AdminReviewQueueDetail.vue'
import AdminReviewQueueList from '~/components/admin/AdminReviewQueueList.vue'
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

const selectedId = ref<string | null>(null)
const actionError = ref<string | null>(null)
const pendingId = ref<string | null>(null)

function select(id: string) {
  selectedId.value = id
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
    selectedId.value = null
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

      <div v-else class="flex overflow-hidden rounded-lg border border-readion-background-surface">
        <AdminReviewQueueList :items="items" :selected-id="selectedId" @select="select" />
        <AdminReviewQueueDetail
          :id="selectedId"
          :pending-id="pendingId"
          @approve="approve"
          @reject="reject"
        />
      </div>
    </template>
  </section>
</template>
