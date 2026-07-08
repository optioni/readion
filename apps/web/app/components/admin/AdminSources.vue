<script setup lang="ts">
import {
  type ContentSourceType,
  contentSourceTypes,
  registerSourceRequestSchema,
} from '@readion/shared'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { ReadionProblemDetailsError } from '~/api/mutator'
import { adminQueryKeys } from '~/composables/adminQueryKeys'
import {
  deriveSourceStatus,
  isJobInFlight,
  latestJob,
  sourceStatusLabel,
  sourceStatusTextClass,
} from '~/composables/sourceStatus'
import { useAdminSources, useSourceJobs } from '~/composables/useAdminSources'
import { lastIngestedTimestamp } from '~/utils/deriveLastIngested'
import { certificationsControllerList } from '~~/src/api/certifications/certifications'
import {
  contentControllerDisable,
  contentControllerEnable,
  contentControllerRegister,
  contentControllerReingest,
} from '~~/src/api/content/content'

const jsonHeaders = { 'Content-Type': 'application/json' }

const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()

const certId = computed(() => (route.query.certificationId as string | undefined) ?? '')

const certsQuery = useQuery({
  queryKey: ['admin', 'certifications-list'],
  queryFn: async () => (await certificationsControllerList()).data.data,
})
const certs = computed(() => certsQuery.data.value ?? [])

const sourcesQuery = useAdminSources(certId)
const sources = computed(() => sourcesQuery.data.value ?? [])
const isLoading = computed(() => sourcesQuery.isLoading.value)
const isError = computed(() => sourcesQuery.isError.value)

const jobsQuery = useSourceJobs(certId, sources)
const jobsBySource = computed(() => jobsQuery.data.value ?? {})

function latestJobFor(sourceId: string) {
  return latestJob(jobsBySource.value[sourceId] ?? [])
}

function statusFor(source: { id: string; enabled: boolean }) {
  return deriveSourceStatus(source, latestJobFor(source.id))
}

const hasRunningJobs = computed(() =>
  sources.value.some((source) => isJobInFlight(latestJobFor(source.id))),
)

const lastIngestedFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

function lastIngestedLabel(source: { id: string; lastFetchedAt: string | null }): string {
  const timestamp = lastIngestedTimestamp(source, latestJobFor(source.id))
  if (timestamp === null) {
    return 'Never'
  }
  return lastIngestedFormatter.format(new Date(timestamp))
}

const showAddSource = ref(false)
const urlInput = ref('')
const selectedType = ref<ContentSourceType>('web')
const registerError = ref<string | null>(null)

function selectCert(id: string) {
  router.replace({ query: { ...route.query, certificationId: id } })
}

async function register() {
  registerError.value = null
  // The certificationId is supplied by the route, so only the user-entered URL needs validating;
  // we reuse the shared schema's URL rule rather than re-deriving it.
  const urlCheck = registerSourceRequestSchema.shape.url.safeParse(urlInput.value)
  if (!urlCheck.success) {
    registerError.value = 'Enter a valid source URL.'
    return
  }
  const body = {
    certificationId: certId.value,
    type: selectedType.value,
    url: urlInput.value,
  }
  try {
    await contentControllerRegister({
      headers: jsonHeaders,
      body: JSON.stringify(body),
    })
    urlInput.value = ''
    showAddSource.value = false
    await queryClient.invalidateQueries({
      queryKey: adminQueryKeys.contentSources(certId.value),
    })
  } catch (error) {
    if (error instanceof ReadionProblemDetailsError) {
      registerError.value = error.detail ?? error.title
    }
  }
}

async function invalidateSourcesAndJobs() {
  await queryClient.invalidateQueries({
    queryKey: adminQueryKeys.contentSources(certId.value),
  })
  await queryClient.invalidateQueries({ queryKey: adminQueryKeys.sourceJobs(certId.value) })
}

async function reingest(id: string) {
  await contentControllerReingest(id, { headers: jsonHeaders })
  await invalidateSourcesAndJobs()
}

async function remove(id: string) {
  await contentControllerDisable(id, { headers: jsonHeaders })
  await invalidateSourcesAndJobs()
}

async function toggleEnabled(source: { id: string; enabled: boolean }) {
  if (source.enabled) {
    await contentControllerDisable(source.id, { headers: jsonHeaders })
  } else {
    await contentControllerEnable(source.id, { headers: jsonHeaders })
  }
  await invalidateSourcesAndJobs()
}
</script>

<template>
  <section data-testid="admin-sources-page" class="flex flex-col gap-6">
    <header class="flex flex-wrap items-center justify-between gap-4">
      <h1 class="font-semibold text-lg text-white">Sources</h1>
    </header>

    <div data-testid="source-cert-pills" class="flex flex-wrap gap-2">
      <button
        v-for="cert in certs"
        :key="cert.id"
        type="button"
        data-testid="source-cert-pill"
        :data-cert-id="cert.id"
        :aria-pressed="cert.id === certId"
        class="rounded-full border px-3 py-1.5 font-medium text-sm transition-colors"
        :class="
          cert.id === certId
            ? 'border-readion-primary bg-readion-primary/10 text-readion-primary'
            : 'border-readion-background-surface text-slate-300 hover:border-readion-primary'
        "
        @click="selectCert(cert.id)"
      >
        {{ cert.name }}
      </button>
    </div>

    <p
      v-if="!certId"
      data-testid="sources-empty-state"
      class="text-slate-400 text-sm"
    >
      Select a certification to view its sources.
    </p>

    <template v-else>
      <div v-if="!showAddSource">
        <button
          type="button"
          data-testid="add-source-toggle"
          class="rounded-md border border-readion-background-surface border-dashed px-4 py-2 font-medium text-slate-300 text-sm transition-colors hover:border-readion-primary hover:text-readion-primary"
          @click="showAddSource = true"
        >
          + Add source
        </button>
      </div>

      <form
        v-else
        data-testid="add-source-form"
        class="flex flex-wrap items-end gap-3"
        @submit.prevent="register"
      >
        <label class="flex flex-col gap-1 text-slate-400 text-xs">
          Source URL
          <input
            v-model="urlInput"
            data-testid="register-source-url-input"
            type="text"
            placeholder="https://…"
            class="w-72 rounded-md border border-readion-background-surface bg-readion-background-overlay px-3 py-1.5 text-slate-100 text-sm"
          />
        </label>
        <label class="flex flex-col gap-1 text-slate-400 text-xs">
          Type
          <select
            v-model="selectedType"
            data-testid="register-source-type-select"
            class="rounded-md border border-readion-background-surface bg-readion-background-overlay px-3 py-1.5 text-slate-100 text-sm"
          >
            <option v-for="type in contentSourceTypes" :key="type" :value="type">{{ type }}</option>
          </select>
        </label>
        <button
          type="submit"
          data-testid="register-source-submit"
          class="rounded-md bg-readion-primary px-4 py-1.5 font-medium text-sm text-white transition-colors hover:bg-readion-primary/90"
        >
          Register
        </button>
        <button
          type="button"
          data-testid="add-source-cancel"
          class="rounded-md border border-readion-background-surface px-4 py-1.5 font-medium text-slate-100 text-sm transition-colors hover:bg-readion-background-surface"
          @click="showAddSource = false"
        >
          Cancel
        </button>
      </form>

      <p v-if="registerError" data-testid="register-source-error" class="text-red-400 text-sm">
        {{ registerError }}
      </p>

      <p
        v-if="hasRunningJobs"
        data-testid="source-jobs-banner"
        class="rounded-md bg-readion-status-warning/10 px-4 py-2 text-readion-status-warning text-sm"
      >
        Ingestion in progress for one or more sources.
      </p>

      <p v-if="isLoading" data-testid="admin-sources-loading" class="text-slate-400 text-sm">
        Loading sources…
      </p>
      <p v-else-if="isError" data-testid="admin-sources-error" class="text-red-400 text-sm">
        Could not load sources. Please try again.
      </p>

      <table v-else class="w-full border-collapse text-left text-sm">
        <thead>
          <tr class="border-readion-background-surface border-b text-slate-400">
            <th class="px-3 py-2 font-medium">Source</th>
            <th class="px-3 py-2 font-medium">Type</th>
            <th class="px-3 py-2 font-medium">Enabled</th>
            <th class="px-3 py-2 font-medium">Last ingested</th>
            <th class="px-3 py-2 font-medium">Chunks</th>
            <th class="px-3 py-2 font-medium">Status</th>
            <th class="px-3 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="source in sources"
            :key="source.id"
            data-testid="source-row"
            :data-source-id="source.id"
            class="border-readion-background-surface/60 border-b"
          >
            <td data-testid="source-url" class="px-3 py-3 text-slate-100">{{ source.url }}</td>
            <td data-testid="source-type" class="px-3 py-3 text-slate-300">{{ source.type }}</td>
            <td class="px-3 py-3">
              <button
                type="button"
                role="switch"
                data-testid="source-enabled-toggle"
                :aria-checked="source.enabled"
                :aria-label="`Toggle ${source.url} enabled`"
                class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
                :class="source.enabled ? 'bg-readion-primary' : 'bg-readion-background-surface'"
                @click="toggleEnabled(source)"
              >
                <span
                  class="inline-block size-5 transform rounded-full bg-white transition-transform"
                  :class="source.enabled ? 'translate-x-[22px]' : 'translate-x-0.5'"
                />
              </button>
            </td>
            <td data-testid="source-last-ingested" class="px-3 py-3 text-slate-300">
              {{ lastIngestedLabel(source) }}
            </td>
            <td data-testid="source-chunk-count" class="px-3 py-3 text-slate-300">
              {{ source.chunkCount }}
            </td>
            <td class="px-3 py-3">
              <span
                data-testid="source-status-pill"
                class="rounded-full bg-readion-background-overlay px-2.5 py-1 font-medium text-xs"
                :class="sourceStatusTextClass(statusFor(source))"
              >
                {{ sourceStatusLabel(statusFor(source)) }}
              </span>
            </td>
            <td class="px-3 py-3">
              <div class="flex gap-2">
                <button
                  type="button"
                  data-testid="source-reingest-btn"
                  class="rounded-md border border-readion-background-surface px-3 py-1.5 font-medium text-slate-100 text-xs transition-colors hover:bg-readion-background-surface"
                  @click="reingest(source.id)"
                >
                  Re-ingest
                </button>
                <button
                  type="button"
                  data-testid="source-disable-btn"
                  class="rounded-md border border-readion-background-surface px-3 py-1.5 font-medium text-slate-100 text-xs transition-colors hover:bg-readion-background-surface"
                  @click="remove(source.id)"
                >
                  Remove
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </template>
  </section>
</template>
