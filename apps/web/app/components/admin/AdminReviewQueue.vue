<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { ReadionProblemDetailsError } from '~/api/mutator'
import AdminReviewQueueDetail from '~/components/admin/AdminReviewQueueDetail.vue'
import AdminReviewQueueList from '~/components/admin/AdminReviewQueueList.vue'
import { adminQueryKeys } from '~/composables/adminQueryKeys'
import { useAdminQuarantine } from '~/composables/useAdminQuarantine'
import { certificationsControllerList } from '~~/src/api/certifications/certifications'
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

const certsQuery = useQuery({
  queryKey: ['admin', 'certifications-list'],
  queryFn: async () => (await certificationsControllerList()).data.data,
})
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
  <section data-testid="admin-review-queue-page" class="flex flex-col gap-6">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h1 class="font-semibold text-lg text-white">Review queue</h1>
      <p
        v-if="!isLoading && !isError"
        data-testid="review-queue-awaiting-count"
        class="text-slate-400 text-sm"
      >
        {{ awaitingCount }} {{ awaitingCount === 1 ? 'item' : 'items' }} awaiting review
      </p>
    </div>

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

      <div v-if="certChips.length > 0" data-testid="review-queue-cert-chips" class="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="review-queue-cert-chip"
          data-cert-id="all"
          :aria-pressed="selectedCertId === null"
          class="rounded-full border px-3 py-1.5 font-medium text-sm transition-colors"
          :class="
            selectedCertId === null
              ? 'border-readion-primary bg-readion-primary/10 text-readion-primary'
              : 'border-readion-background-surface text-slate-300 hover:border-readion-primary'
          "
          @click="selectCertFilter(null)"
        >
          All
        </button>
        <button
          v-for="chip in certChips"
          :key="chip.id"
          type="button"
          data-testid="review-queue-cert-chip"
          :data-cert-id="chip.id"
          :aria-pressed="selectedCertId === chip.id"
          class="rounded-full border px-3 py-1.5 font-medium text-sm transition-colors"
          :class="
            selectedCertId === chip.id
              ? 'border-readion-primary bg-readion-primary/10 text-readion-primary'
              : 'border-readion-background-surface text-slate-300 hover:border-readion-primary'
          "
          @click="selectCertFilter(chip.id)"
        >
          {{ chip.label }}
        </button>
      </div>

      <div class="flex overflow-hidden rounded-lg border border-readion-background-surface">
        <div
          v-if="items.length === 0"
          data-testid="review-queue-empty"
          class="flex w-80 flex-shrink-0 items-center justify-center border-readion-background-surface border-r border-dashed bg-readion-background-surface/40 px-6 py-10 text-center text-slate-400 text-sm"
        >
          No quarantined items are awaiting review.
        </div>
        <AdminReviewQueueList
          v-else
          :items="filteredItems"
          :selected-id="selectedId"
          :certs-by-id="certsById"
          @select="select"
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
