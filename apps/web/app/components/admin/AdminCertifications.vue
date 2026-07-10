<script setup lang="ts">
import type { CertExtractionFields, DueForReverificationItem } from '@readion/shared'
import { reverifyCertificationRequestSchema } from '@readion/shared'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import { ReadionProblemDetailsError } from '~/api/mutator'
import AdminAsyncMessage from '~/components/admin/AdminAsyncMessage.vue'
import AdminHeaderBar from '~/components/admin/AdminHeaderBar.vue'
import AdminTableShell from '~/components/admin/AdminTableShell.vue'
import { readDataEnvelope, readExtractionStatusEnvelope } from '~/composables/adminEnvelope'
import { adminQueryKeys } from '~/composables/adminQueryKeys'
import { isTerminalWithoutFields, nextRefetchInterval } from '~/composables/certExtractionPoll'
import { buildCertDiff, buildReverifyBody, type CertDiff } from '~/composables/certReverifyDiff'
import { discoverCertSources, enqueueCertExtraction } from '~/composables/certSetupKickoff'
import { useAdminCertificationsList } from '~/composables/useAdminCertificationsList'
import { useDueForReverification } from '~/composables/useDueForReverification'
import {
  certSetupControllerReadExtraction,
  certSetupControllerReverify,
} from '~~/src/api/cert-setup/cert-setup'
import { certificationsControllerDetail } from '~~/src/api/certifications/certifications'
import type { CertificationResponseDto } from '~~/src/api/model/certificationResponseDto'

const jsonHeaders = { 'Content-Type': 'application/json' }

const queryClient = useQueryClient()
const dueQuery = useDueForReverification()

const dueItems = computed<DueForReverificationItem[]>(() => dueQuery.data.value ?? [])
const isLoading = computed(() => dueQuery.isLoading.value)
const isError = computed(() => dueQuery.isError.value)

const existingCertsQuery = useAdminCertificationsList()
const existingCerts = computed<CertificationResponseDto[]>(
  () => existingCertsQuery.data.value ?? [],
)

const activeCertId = ref<string | null>(null)
const currentCert = ref<CertificationResponseDto | null>(null)
const confirmedSourceUrl = ref<string | null>(null)
const jobId = ref<string | null>(null)
const extractionFields = ref<CertExtractionFields | null>(null)
const diff = ref<CertDiff | null>(null)
const reverifyError = ref<string | null>(null)
const submitting = ref(false)

const extractionQuery = useQuery({
  queryKey: computed(() => adminQueryKeys.extraction(jobId.value ?? '')),
  queryFn: async () =>
    readExtractionStatusEnvelope(await certSetupControllerReadExtraction(jobId.value as string)),
  enabled: computed(() => Boolean(jobId.value)),
  refetchInterval: (query) => nextRefetchInterval(query.state.data, query.state.fetchFailureCount),
})

watch(
  () => extractionQuery.data.value,
  (data) => {
    if (!data || !currentCert.value) return
    if (data.fields) {
      extractionFields.value = data.fields
      diff.value = buildCertDiff(currentCert.value, data.fields)
      return
    }
    if (isTerminalWithoutFields(data)) {
      reverifyError.value = 'Extraction did not produce any fields. Please try again.'
    }
  },
)

function resetFlow(): void {
  activeCertId.value = null
  currentCert.value = null
  confirmedSourceUrl.value = null
  jobId.value = null
  extractionFields.value = null
  diff.value = null
}

async function startReverify(item: DueForReverificationItem): Promise<void> {
  resetFlow()
  reverifyError.value = null
  activeCertId.value = item.id

  try {
    const detail = await certificationsControllerDetail(item.id)
    currentCert.value = readDataEnvelope<CertificationResponseDto>(detail)

    const discovered = await discoverCertSources(item.name, item.code)
    confirmedSourceUrl.value = discovered.candidates[0]?.url ?? ''

    jobId.value = await enqueueCertExtraction(item.name, item.code, confirmedSourceUrl.value)
  } catch (error) {
    reverifyError.value =
      error instanceof ReadionProblemDetailsError
        ? (error.detail ?? error.title)
        : 'Re-verification could not be started. Please try again.'
  }
}

async function submitReverify(): Promise<void> {
  if (
    !activeCertId.value ||
    !diff.value ||
    !extractionFields.value ||
    confirmedSourceUrl.value === null
  ) {
    return
  }
  submitting.value = true
  reverifyError.value = null
  try {
    const body = reverifyCertificationRequestSchema.parse(
      buildReverifyBody(confirmedSourceUrl.value, diff.value.proposed, extractionFields.value),
    )
    await certSetupControllerReverify(activeCertId.value, {
      headers: jsonHeaders,
      body: JSON.stringify(body),
    })
    await queryClient.invalidateQueries({ queryKey: adminQueryKeys.dueForReverification() })
    resetFlow()
  } catch (error) {
    reverifyError.value =
      error instanceof ReadionProblemDetailsError
        ? (error.detail ?? error.title)
        : 'Re-verification failed. Please try again.'
  } finally {
    submitting.value = false
  }
}

function cancelReverify(): void {
  resetFlow()
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

    <p
      v-if="existingCerts.length === 0"
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
            <button
              type="button"
              data-testid="reverify-btn"
              class="rounded-md border border-readion-background-surface px-3 py-1.5 font-medium text-slate-100 text-xs transition-colors hover:bg-readion-background-surface"
              @click="startReverify(item)"
            >
              Re-verify
            </button>
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
                  <span v-if="row.unverified" class="ml-1 text-slate-500 text-xs">(unverified)</span>
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
          <button
            type="button"
            data-testid="reverify-cancel-btn"
            class="rounded-lg border border-readion-background-surface px-4 py-2 font-medium text-slate-100 text-sm transition-colors hover:bg-readion-background-surface"
            @click="cancelReverify"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="reverify-submit-btn"
            :disabled="submitting"
            class="inline-flex items-center gap-2 rounded-lg bg-readion-primary px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-readion-primary/90 disabled:opacity-50"
            @click="submitReverify"
          >
            <span
              v-if="submitting"
              data-testid="reverify-submitting-spinner"
              class="size-3.5 animate-spin rounded-full border-2 border-white/35 border-t-white"
            />
            {{ submitting ? 'Re-verifying…' : 'Accept all & re-verify' }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
