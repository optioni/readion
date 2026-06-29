<script setup lang="ts">
import {
  type DiscoveryCandidate,
  discoverSourcesRequestSchema,
  extractRequestSchema,
} from '@readion/shared'
import { computed, ref } from 'vue'
import { ReadionProblemDetailsError } from '~/api/mutator'
import { readDiscoverSourcesEnvelope } from '~/composables/adminEnvelope'
import type { CertSetupWizardState } from '~/composables/useCertSetupWizard'
import { certSetupControllerDiscoverSources } from '~~/src/api/cert-setup/cert-setup'

const props = defineProps<{
  state: CertSetupWizardState
  confirmSource: (url: string) => Promise<void>
}>()

const jsonHeaders = { 'Content-Type': 'application/json' }

const candidates = ref<DiscoveryCandidate[]>([])
const selectedUrl = ref<string | null>(null)
const manualUrl = ref('')
const discoverError = ref<string | null>(null)

const canDiscover = computed(() => props.state.name.trim().length > 0)

// Manual entry wins over the candidate list when present; otherwise the selected
// candidate's url is confirmed.
const effectiveUrl = computed(() => manualUrl.value.trim() || selectedUrl.value || '')

function isValidUrl(url: string): boolean {
  return extractRequestSchema.shape.confirmedSourceUrl.safeParse(url).success
}

const canConfirm = computed(() => isValidUrl(effectiveUrl.value))

async function discover() {
  if (!canDiscover.value) return
  discoverError.value = null
  const body = discoverSourcesRequestSchema.parse({
    name: props.state.name,
    ...(props.state.code ? { code: props.state.code } : {}),
  })
  try {
    const response = await certSetupControllerDiscoverSources({
      headers: jsonHeaders,
      body: JSON.stringify(body),
    })
    candidates.value = readDiscoverSourcesEnvelope(response).candidates
  } catch (error) {
    if (error instanceof ReadionProblemDetailsError) {
      discoverError.value = error.detail ?? error.title
    }
  }
}

function selectCandidate(url: string) {
  selectedUrl.value = url
}

async function confirm() {
  if (!canConfirm.value) return
  await props.confirmSource(effectiveUrl.value)
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <h1 class="font-semibold text-lg text-white">New certification</h1>

    <div class="flex flex-col gap-3">
      <label for="discover-name" class="font-mono text-slate-400 text-xs uppercase tracking-wide">
        Certification name
      </label>
      <input
        id="discover-name"
        v-model="state.name"
        data-testid="discover-name-input"
        class="rounded-lg border border-readion-background-surface bg-readion-background-elevated px-3 py-2 text-slate-100 text-sm"
      />

      <label for="discover-code" class="font-mono text-slate-400 text-xs uppercase tracking-wide">
        Code (optional)
      </label>
      <input
        id="discover-code"
        v-model="state.code"
        data-testid="discover-code-input"
        class="rounded-lg border border-readion-background-surface bg-readion-background-elevated px-3 py-2 text-slate-100 text-sm"
      />

      <button
        type="button"
        data-testid="discover-submit-btn"
        :disabled="!canDiscover"
        class="self-start rounded-lg bg-readion-primary px-5 py-2.5 font-medium text-sm text-white transition-colors hover:bg-readion-primary/90 disabled:opacity-60"
        @click="discover"
      >
        Discover sources
      </button>

      <p v-if="discoverError" data-testid="discover-error" class="text-red-400 text-sm">
        {{ discoverError }}
      </p>
    </div>

    <div v-if="candidates.length" class="flex flex-col gap-3">
      <h2 class="font-medium text-slate-100 text-sm">Candidate sources</h2>

      <ul class="flex flex-col gap-2">
        <li v-for="candidate in candidates" :key="candidate.url">
          <button
            type="button"
            data-testid="source-candidate"
            :data-url="candidate.url"
            :data-selected="selectedUrl === candidate.url ? 'true' : 'false'"
            class="flex w-full flex-col gap-1 rounded-lg border px-4 py-3 text-left transition-colors"
            :class="
              selectedUrl === candidate.url
                ? 'border-readion-primary bg-readion-primary/10'
                : 'border-readion-background-surface hover:bg-readion-background-surface'
            "
            @click="selectCandidate(candidate.url)"
          >
            <span class="font-medium text-slate-100 text-sm">{{ candidate.title }}</span>
            <span class="break-all text-slate-400 text-xs">{{ candidate.url }}</span>
            <span v-if="candidate.snippet" class="text-slate-400 text-xs">
              {{ candidate.snippet }}
            </span>
          </button>
        </li>
      </ul>

      <label for="manual-url" class="font-mono text-slate-400 text-xs uppercase tracking-wide">
        Or paste an official-guide URL
      </label>
      <input
        id="manual-url"
        v-model="manualUrl"
        data-testid="manual-url-input"
        placeholder="https://…"
        class="rounded-lg border border-readion-background-surface bg-readion-background-elevated px-3 py-2 text-slate-100 text-sm"
      />

      <button
        type="button"
        data-testid="confirm-source-btn"
        :disabled="!canConfirm"
        class="self-start rounded-lg bg-readion-primary px-5 py-2.5 font-medium text-sm text-white transition-colors hover:bg-readion-primary/90 disabled:opacity-60"
        @click="confirm"
      >
        Confirm source &amp; extract
      </button>
    </div>
  </div>
</template>
