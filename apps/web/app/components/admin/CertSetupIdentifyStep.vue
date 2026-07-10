<script setup lang="ts">
import { computed, ref } from 'vue'
import { ReadionProblemDetailsError } from '~/api/mutator'
import AdminWizardFooter from '~/components/admin/AdminWizardFooter.vue'
import type { CertSetupWizardState } from '~/composables/useCertSetupWizard'

const props = defineProps<{
  state: CertSetupWizardState
  submitIdentity: (
    name: string,
    code: string,
    provider: string,
    knownSourceUrl: string,
  ) => Promise<void>
}>()

const name = ref(props.state.name)
const code = ref(props.state.code)
const provider = ref(props.state.identity.provider)
const knownUrl = ref(props.state.knownSourceUrl ?? '')
const searchError = ref<string | null>(null)
const searching = ref(false)

const canSearch = computed(() => name.value.trim().length > 0 && code.value.trim().length > 0)

async function search(): Promise<void> {
  if (!canSearch.value || searching.value) return
  searchError.value = null
  searching.value = true
  try {
    await props.submitIdentity(
      name.value.trim(),
      code.value.trim(),
      provider.value.trim(),
      knownUrl.value.trim(),
    )
  } catch (error) {
    searchError.value =
      error instanceof ReadionProblemDetailsError
        ? (error.detail ?? error.title)
        : 'Could not search for sources. Please try again.'
  } finally {
    searching.value = false
  }
}

function cancel(): void {
  navigateTo('/admin/certifications')
}
</script>

<template>
  <div data-testid="cert-identify-step" class="max-w-[640px]">
    <p data-testid="identify-intro" class="mb-6 text-slate-400 text-sm leading-relaxed">
      Tell the setup agent which certification to build. It will search for the official exam
      guide and candidate handbook from these details in the next step.
    </p>

    <div class="mb-4 flex flex-col gap-1.5">
      <label for="identify-name" class="font-medium text-slate-300 text-xs">
        Certification name
      </label>
      <input
        id="identify-name"
        v-model="name"
        data-testid="identify-name-input"
        placeholder="e.g. Certified Kubernetes Security Specialist"
        class="rounded-lg border border-readion-background-surface bg-readion-background-elevated px-3 py-2 text-slate-100 text-sm"
      />
    </div>

    <div class="mb-4 flex gap-4">
      <div class="flex flex-1 flex-col gap-1.5">
        <label for="identify-code" class="font-medium text-slate-300 text-xs">Exam code</label>
        <input
          id="identify-code"
          v-model="code"
          data-testid="identify-code-input"
          placeholder="e.g. CKS"
          class="rounded-lg border border-readion-background-surface bg-readion-background-elevated px-3 py-2 font-mono text-slate-100 text-sm"
        />
        <p data-testid="identify-code-hint" class="text-slate-500 text-xs leading-relaxed">
          Shown across the app and used to de-duplicate.
        </p>
      </div>
      <div class="flex flex-[1.4] flex-col gap-1.5">
        <label for="identify-provider" class="font-medium text-slate-300 text-xs">
          Certifying body
        </label>
        <input
          id="identify-provider"
          v-model="provider"
          data-testid="identify-provider-input"
          placeholder="e.g. Amazon Web Services"
          class="rounded-lg border border-readion-background-surface bg-readion-background-elevated px-3 py-2 text-slate-100 text-sm"
        />
      </div>
    </div>

    <div class="mb-4 flex flex-col gap-1.5">
      <label for="identify-known-url" class="flex items-center gap-1.5 font-medium text-slate-300 text-xs">
        Known source URL
        <span class="font-normal text-slate-500">Optional</span>
      </label>
      <input
        id="identify-known-url"
        v-model="knownUrl"
        data-testid="identify-known-url-input"
        placeholder="https://…"
        class="rounded-lg border border-readion-background-surface bg-readion-background-elevated px-3 py-2 font-mono text-slate-100 text-sm"
      />
      <p class="text-slate-500 text-xs leading-relaxed">
        Paste the official exam-guide URL if you have one. Otherwise the agent searches for
        candidate sources in the next step.
      </p>
    </div>

    <div
      data-testid="identify-next-callout"
      class="flex gap-2.5 rounded-lg border border-readion-accent-label/20 bg-readion-accent-label/5 px-3.5 py-3 text-xs"
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="mt-0.5 shrink-0 text-readion-accent-label"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
      <span class="text-slate-300 leading-relaxed">
        Next, the agent searches official sources for
        <strong class="text-slate-100">{{ code || 'this certification' }}</strong>
        and returns ranked candidates for you to confirm — no metadata is created until you
        approve a source.
      </span>
    </div>

    <p v-if="searchError" data-testid="identify-error" class="mt-3 text-red-400 text-sm">
      {{ searchError }}
    </p>

    <AdminWizardFooter
      cta-label="Search for sources →"
      cta-testid="identify-search-btn"
      cancel-testid="identify-cancel-btn"
      :cta-disabled="!canSearch || searching"
      @cancel="cancel"
      @submit="search"
    />
  </div>
</template>
