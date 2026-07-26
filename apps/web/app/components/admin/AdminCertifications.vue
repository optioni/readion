<script setup lang="ts">
import type { DueForReverificationItem } from '@readion/shared'
import { useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import AdminAsyncMessage from '~/components/admin/AdminAsyncMessage.vue'
import AdminHeaderBar from '~/components/admin/AdminHeaderBar.vue'
import AdminTableShell from '~/components/admin/AdminTableShell.vue'
import ReadionButton from '~/components/ReadionButton.vue'
import { adminQueryKeys } from '~/composables/adminQueryKeys'
import { useAdminCertificationsList } from '~/composables/useAdminCertificationsList'
import { useCertReverifyFlow } from '~/composables/useCertReverifyFlow'
import { useDueForReverification } from '~/composables/useDueForReverification'
import type { CertificationResponseDto } from '~~/src/api/model/certificationResponseDto'

const queryClient = useQueryClient()
const dueQuery = useDueForReverification()

const dueItems = computed<DueForReverificationItem[]>(() => dueQuery.data.value ?? [])
const isLoading = computed(() => dueQuery.isLoading.value && dueItems.value.length === 0)
const isError = computed(() => dueQuery.isError.value && dueItems.value.length === 0)

const existingCertsQuery = useAdminCertificationsList()
const existingCerts = computed<CertificationResponseDto[]>(
  () => existingCertsQuery.data.value ?? [],
)
const existingCertsLoading = computed(
  () => existingCertsQuery.isLoading.value && existingCerts.value.length === 0,
)
const existingCertsError = computed(
  () => existingCertsQuery.isError.value && existingCerts.value.length === 0,
)

const { activeCertId, diff, reverifyError, starting, submitting, start, submit, reset } =
  useCertReverifyFlow(() =>
    queryClient.invalidateQueries({ queryKey: adminQueryKeys.dueForReverification() }),
  )

function isStarting(itemId: string): boolean {
  return starting.value === true && activeCertId.value === itemId
}

function startReverify(item: DueForReverificationItem): Promise<void> {
  return start(item)
}

function submitReverify(): Promise<void> {
  return submit()
}

function cancelReverify(): void {
  reset()
  reverifyError.value = null
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

function formatVerifiedAt(verifiedAt: string | null): string {
  return verifiedAt ? dateFormatter.format(new Date(verifiedAt)) : 'Never'
}
</script>

<template>
  <section data-testid="admin-certifications-page" class="flex flex-col gap-6">
    <AdminHeaderBar
      title="Certifications"
      subtitle="Manage certifications and keep their metadata verified against source."
    >
      <NuxtLink
        to="/admin/certifications/new"
        data-testid="new-certification-link"
        class="inline-flex items-center gap-1.5 rounded-lg bg-readion-primary px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-readion-primary/90"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M7 2v10M2 7h10" />
        </svg>
        New certification
      </NuxtLink>
    </AdminHeaderBar>

    <div class="flex items-baseline gap-2">
      <h2
        data-testid="existing-certs-section-label"
        class="font-medium text-slate-400 text-xs uppercase tracking-widest"
      >
        Existing certifications
      </h2>
      <span
        v-if="existingCerts.length > 0"
        data-testid="existing-certs-count"
        class="text-slate-500 text-xs"
      >
        {{ existingCerts.length }} active
      </span>
    </div>

    <AdminAsyncMessage
      v-if="existingCertsLoading"
      kind="loading"
      message="Loading certifications…"
      data-testid="existing-certs-loading"
    />
    <AdminAsyncMessage
      v-else-if="existingCertsError"
      kind="error"
      message="Could not load certifications. Please try again."
      :retrying="existingCertsQuery.isFetching.value"
      data-testid="existing-certs-error"
      @retry="existingCertsQuery.refetch()"
    />
    <p
      v-else-if="existingCerts.length === 0"
      data-testid="existing-certs-empty"
      class="text-slate-400 text-sm"
    >
      No certifications have been set up yet.
    </p>

    <AdminTableShell v-else>
    <table class="w-full border-collapse text-left text-sm">
      <thead>
        <tr class="border-readion-background-surface border-b text-slate-400">
          <th class="px-3 py-2 font-medium">Certification</th>
          <th class="px-3 py-2 font-medium">Code</th>
          <th class="px-3 py-2 font-medium">Provider</th>
          <th class="px-3 py-2 font-medium">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="cert in existingCerts"
          :key="cert.id"
          data-testid="existing-cert-row"
          :data-cert-id="cert.id"
          class="border-readion-background-surface/60 border-b"
        >
          <td class="px-3 py-3 text-slate-100">{{ cert.name }}</td>
          <td class="px-3 py-3">
            <span data-testid="existing-cert-code-chip" class="rounded-sm border border-readion-border-strong bg-readion-background-elevated px-1.5 py-0.5 font-mono text-slate-300 text-xs">{{ cert.code }}</span>
          </td>
          <td class="px-3 py-3 text-slate-300">{{ cert.provider }}</td>
          <td class="px-3 py-3">
            <NuxtLink
              data-testid="existing-cert-link"
              :to="{ path: '/admin/sources', query: { certificationId: cert.id } }"
              class="font-medium text-readion-primary text-xs hover:underline"
            >
              Manage sources
            </NuxtLink>
          </td>
        </tr>
      </tbody>
    </table>
    </AdminTableShell>

    <h2 class="font-medium text-slate-400 text-xs uppercase tracking-widest">
      Due for re-verification
    </h2>

    <AdminAsyncMessage
      v-if="isLoading"
      kind="loading"
      message="Loading certifications…"
      data-testid="due-loading"
    />
    <AdminAsyncMessage
      v-else-if="isError"
      kind="error"
      message="Could not load certifications. Please try again."
      :retrying="dueQuery.isFetching?.value ?? false"
      data-testid="due-error"
      @retry="dueQuery.refetch()"
    />
    <p v-else-if="dueItems.length === 0" data-testid="due-empty" class="text-slate-400 text-sm">
      No certifications are due for re-verification.
    </p>

    <AdminTableShell v-else>
    <table class="w-full border-collapse text-left text-sm">
      <thead>
        <tr class="border-readion-background-surface border-b text-slate-400">
          <th class="px-3 py-2 font-medium">Certification</th>
          <th class="px-3 py-2 font-medium">Code</th>
          <th class="px-3 py-2 font-medium">Last verified</th>
          <th class="px-3 py-2 font-medium">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in dueItems"
          :key="item.id"
          data-testid="due-reverification-row"
          :data-cert-id="item.id"
          class="border-readion-background-surface/60 border-b"
        >
          <td class="px-3 py-3 text-slate-100">{{ item.name }}</td>
          <td class="px-3 py-3">
            <span data-testid="due-cert-code-chip" class="rounded-sm border border-readion-border-strong bg-readion-background-elevated px-1.5 py-0.5 font-mono text-slate-300 text-xs">{{ item.code }}</span>
          </td>
          <td class="px-3 py-3 text-slate-300">{{ formatVerifiedAt(item.verifiedAt) }}</td>
          <td class="px-3 py-3">
            <ReadionButton
              data-testid="reverify-btn"
              variant="secondary"
              :disabled="starting"
              :busy="isStarting(item.id)"
              busy-label="Re-verifying…"
              class="!min-h-0 px-3 py-1.5 text-xs"
              @click="startReverify(item)"
            >
              Re-verify
            </ReadionButton>
          </td>
        </tr>
      </tbody>
    </table>
    </AdminTableShell>

    <p v-if="reverifyError && !diff" data-testid="reverify-error" class="text-red-400 text-sm">
      {{ reverifyError }}
    </p>

    <div
      v-if="diff"
      data-testid="reverify-diff-backdrop"
      class="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-8"
    >
      <div
        data-testid="reverify-diff-modal"
        class="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-readion-border-strong bg-readion-background-overlay shadow-2xl"
      >
        <div data-testid="reverify-diff" class="flex flex-col gap-4 overflow-y-auto px-5 py-5">
          <div>
            <h2 class="font-semibold text-base text-white">Proposed changes</h2>
            <p class="mt-0.5 text-slate-400 text-xs">
              Re-verified against the latest source. Review before accepting.
            </p>
          </div>
          <table class="w-full border-collapse text-left text-sm">
            <thead>
              <tr class="border-readion-background-surface border-b text-slate-400">
                <th class="px-3 py-2 font-medium">Field</th>
                <th class="px-3 py-2 font-medium">Current</th>
                <th class="px-3 py-2 font-medium">Proposed</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in diff.rows"
                :key="row.key"
                :data-testid="`reverify-diff-row-${row.key}`"
                :data-changed="row.changed ? 'true' : 'false'"
                class="border-readion-background-surface/60 border-b"
              >
                <td class="px-3 py-3 text-slate-300">
                  {{ row.label }}
                </td>
                <td class="px-3 py-3 text-slate-300">{{ row.current }}</td>
                <td
                  class="px-3 py-3"
                  :class="row.changed ? 'text-readion-primary' : 'text-slate-300'"
                >
                  {{ row.proposed }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="flex items-center gap-3 border-readion-border-strong border-t px-5 py-4">
          <p v-if="reverifyError" data-testid="reverify-error" class="text-red-400 text-sm">
            {{ reverifyError }}
          </p>
          <div class="flex-1" />
          <ReadionButton
            data-testid="reverify-cancel-btn"
            variant="secondary"
            :disabled="submitting"
            @click="cancelReverify"
          >
            Cancel
          </ReadionButton>
          <ReadionButton
            data-testid="reverify-submit-btn"
            :busy="submitting"
            busy-label="Re-verifying…"
            @click="submitReverify"
          >
            Accept all & re-verify
          </ReadionButton>
        </div>
      </div>
    </div>
  </section>
</template>
