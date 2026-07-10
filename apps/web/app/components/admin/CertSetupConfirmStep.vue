<script setup lang="ts">
import { extractRequestSchema } from '@readion/shared'
import { computed, ref } from 'vue'
import AdminWizardFooter from '~/components/admin/AdminWizardFooter.vue'
import type { CertSetupWizardState } from '~/composables/useCertSetupWizard'

const props = defineProps<{
  state: CertSetupWizardState
  confirmSource: (url: string) => Promise<void>
}>()

const selectedUrl = ref<string | null>(null)
const manualUrl = ref(props.state.knownSourceUrl ?? '')
const confirming = ref(false)

// Manual entry wins over the candidate list when present; otherwise the selected
// candidate's url is confirmed.
const effectiveUrl = computed(() => manualUrl.value.trim() || selectedUrl.value || '')

function isValidUrl(url: string): boolean {
  return extractRequestSchema.shape.confirmedSourceUrl.safeParse(url).success
}

const canConfirm = computed(() => isValidUrl(effectiveUrl.value) && !confirming.value)

function selectCandidate(url: string) {
  selectedUrl.value = url
}

async function confirm() {
  if (!canConfirm.value) return
  confirming.value = true
  try {
    await props.confirmSource(effectiveUrl.value)
  } finally {
    confirming.value = false
  }
}

function cancel(): void {
  navigateTo('/admin/certifications')
}
</script>

<template>
  <div data-testid="cert-confirm-step" class="max-w-[640px]">
    <p class="mb-5 text-slate-400 text-sm leading-relaxed">
      The setup agent searched for the official {{ state.code || state.name }} exam guide and
      candidate handbook. Confirm the primary source before field extraction begins.
    </p>

    <div
      data-testid="confirm-agent-status"
      class="mb-5 flex items-center gap-2 rounded-lg border border-readion-status-good/20 bg-readion-status-good/5 px-3.5 py-2.5 text-readion-status-good text-xs"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <span>Found {{ state.discoveryCandidates.length }} candidate sources.</span>
    </div>

    <div class="mb-2.5 font-medium text-slate-400 text-xs uppercase tracking-wide">
      Select primary source
    </div>
    <ul class="mb-4 flex flex-col gap-2">
      <li v-for="candidate in state.discoveryCandidates" :key="candidate.url">
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

    <div class="rounded-lg border border-readion-background-surface bg-readion-background-surface/50 px-3.5 py-3">
      <label for="manual-url" class="mb-2 block text-slate-400 text-xs">
        Or enter a URL manually
      </label>
      <input
        id="manual-url"
        v-model="manualUrl"
        data-testid="manual-url-input"
        placeholder="https://…"
        class="w-full rounded-lg border border-readion-background-surface bg-readion-background-elevated px-3 py-2 font-mono text-slate-100 text-sm"
      />
    </div>

    <AdminWizardFooter
      cta-label="Confirm source & extract fields →"
      cta-testid="confirm-source-btn"
      cancel-testid="confirm-cancel-btn"
      :cta-disabled="!canConfirm"
      @cancel="cancel"
      @submit="confirm"
    />
  </div>
</template>
