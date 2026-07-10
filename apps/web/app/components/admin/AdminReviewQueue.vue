<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { ReadionProblemDetailsError } from '~/api/mutator'
import AdminAsyncMessage from '~/components/admin/AdminAsyncMessage.vue'
import AdminHeaderBar from '~/components/admin/AdminHeaderBar.vue'
import AdminReviewQueueDetail from '~/components/admin/AdminReviewQueueDetail.vue'
import AdminReviewQueueList from '~/components/admin/AdminReviewQueueList.vue'
import { adminQueryKeys } from '~/composables/adminQueryKeys'
import { useAdminCertificationsList } from '~/composables/useAdminCertificationsList'
import { useAdminQuarantine } from '~/composables/useAdminQuarantine'
import {
  quarantineAdminControllerApprove,
  quarantineAdminControllerReject,
} from '~~/src/api/quarantine-admin/quarantine-admin'

const queryClient = useQueryClient()
const quarantineQuery = useAdminQuarantine()

const items = computed(() => quarantineQuery.data.value?.data ?? [])
const awaitingCount = computed(() => quarantineQuery.data.value?.meta.total ?? items.value.length)
const isLoading = computed(() => quarantineQuery.isLoading.value)
const isError = computed(() => quarantineQuery.isError.value)

const certsQuery = useAdminCertificationsList()
const certsById = computed(() =>
  Object.fromEntries((certsQuery.data.value ?? []).map((cert) => [cert.id, cert])),
)

const selectedCertId = ref<string | null>(null)

const certChips = computed(() => {
  const uniqueCertIds = Array.from(new Set(items.value.map((item) => item.certificationId)))
  return uniqueCertIds.map((certId) => ({
    id: certId,
    label: certsById.value[certId]?.code ?? certsById.value[certId]?.name ?? certId,
  }))
})

const filteredItems = computed(() =>
  selectedCertId.value === null
    ? items.value
    : items.value.filter((item) => item.certificationId === selectedCertId.value),
)

function selectCertFilter(certId: string | null) {
  selectedCertId.value = certId
}

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
  <section data-testid="admin-review-queue-page" class="flex h-full min-h-[calc(100vh-4rem)] flex-col">
    <AdminHeaderBar title="Review queue">
      <span
        v-if="!isLoading && !isError"
        data-testid="review-queue-awaiting-count"
        class="text-slate-400 text-sm"
      >
        {{ awaitingCount }} {{ awaitingCount === 1 ? 'item' : 'items' }} awaiting review
      </span>
    </AdminHeaderBar>

    <AdminAsyncMessage
      v-if="isLoading"
      kind="loading"
      message="Loading quarantined items…"
      data-testid="admin-review-queue-loading"
    />
    <AdminAsyncMessage
      v-else-if="isError"
      kind="error"
      message="Could not load the review queue. Please try again."
      data-testid="admin-review-queue-error"
      @retry="quarantineQuery.refetch()"
    />

    <template v-else>
      <p
        v-if="actionError"
        data-testid="review-queue-error-banner"
        class="px-7 pt-3 text-red-400 text-sm"
      >
        {{ actionError }}
      </p>

      <div class="flex flex-1 overflow-hidden">
        <div
          v-if="items.length === 0"
          data-testid="review-queue-empty"
          class="flex w-80 flex-shrink-0 items-center justify-center border-readion-border-strong border-r bg-readion-background-surface/40 px-6 py-10 text-center text-slate-400 text-sm"
        >
          No quarantined items are awaiting review.
        </div>
        <AdminReviewQueueList
          v-else
          :items="filteredItems"
          :selected-id="selectedId"
          :certs-by-id="certsById"
          :cert-chips="certChips"
          :selected-cert-id="selectedCertId"
          @select="select"
          @select-cert-filter="selectCertFilter"
        />
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
