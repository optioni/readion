<script setup lang="ts">
import type {
  CertExtractionFields,
  CertExtractionResult,
  ExtractedField,
  JobProgressEvent,
} from '@readion/shared'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import CertFieldRow from '~/components/admin/CertFieldRow.vue'
import { readExtractionStatusEnvelope } from '~/composables/adminEnvelope'
import { isTerminalWithoutFields } from '~/composables/certExtractionPoll'
import type { CertExtractionFieldKey, CertSetupWizardState } from '~/composables/useCertSetupWizard'
import { useReadionEventSource } from '~/composables/useReadionEventSource'
import {
  certSetupControllerReadExtraction,
  getCertSetupControllerStreamExtractionEventsUrl,
} from '~~/src/api/cert-setup/cert-setup'

const props = defineProps<{
  state: CertSetupWizardState
  applyExtraction: (fields: CertExtractionFields) => void
  editFieldValue: <K extends CertExtractionFieldKey>(
    key: K,
    value: CertSetupWizardState['fieldValues'][K],
  ) => void
  flagField: (key: CertExtractionFieldKey) => void
}>()

type NumericKey = 'questionCount' | 'passingScore' | 'timeLimitMinutes'

const FIELD_KEYS: CertExtractionFieldKey[] = [
  'domains',
  'questionCount',
  'passingScore',
  'timeLimitMinutes',
]

const FIELD_LABELS: Record<CertExtractionFieldKey, string> = {
  domains: 'Domains',
  questionCount: 'Question count',
  passingScore: 'Passing score (%)',
  timeLimitMinutes: 'Time limit (minutes)',
}

const reviewState = reactive<Partial<Record<CertExtractionFieldKey, 'confirmed' | 'flagged'>>>({})

const jobId = computed(() => props.state.extractionJobId ?? '')
const failed = ref(false)

// The wizard learns of completion over a server-pushed SSE stream instead of polling. The stream
// emits the terminal `completed`/`failed` event and the server closes; we also close the
// EventSource on that event so it does not auto-reconnect to the closed stream.
const { latestMessage, close } = useReadionEventSource<JobProgressEvent<CertExtractionResult>>(
  () => (jobId.value ? getCertSetupControllerStreamExtractionEventsUrl(jobId.value) : ''),
)

watch(
  latestMessage,
  (message) => {
    if (!message) return
    if (message.state === 'completed') {
      if (message.result?.fields) props.applyExtraction(message.result.fields)
      close()
    } else if (message.state === 'failed') {
      failed.value = true
      close()
    }
  },
  { immediate: true },
)

async function fetchStatusOnce(): Promise<void> {
  if (!jobId.value) return
  const status = readExtractionStatusEnvelope(await certSetupControllerReadExtraction(jobId.value))
  if (status.fields) props.applyExtraction(status.fields)
  else if (isTerminalWithoutFields(status)) failed.value = true
}

// A single status GET fallback: covers the initial paint, a job that finished before the stream
// connected, and proxies/browsers that drop SSE. It is not polled on an interval.
onMounted(() => {
  if (!props.state.fields) void fetchStatusOnce()
})

const ready = computed(() => Boolean(props.state.fields))
const errored = computed(() => failed.value && !ready.value)
const loading = computed(() => !ready.value && !errored.value)

function fieldOf(key: CertExtractionFieldKey): ExtractedField<unknown> {
  return (props.state.fields as CertExtractionFields)[key]
}

function numericValueOf(key: CertExtractionFieldKey): number | null {
  return key === 'domains' ? null : props.state.fieldValues[key as NumericKey]
}

function onEdit(key: CertExtractionFieldKey, value: number | null): void {
  if (key === 'domains') return
  props.editFieldValue(key as NumericKey, value)
}

function confirmField(key: CertExtractionFieldKey): void {
  reviewState[key] = 'confirmed'
}

function flag(key: CertExtractionFieldKey): void {
  reviewState[key] = 'flagged'
  props.flagField(key)
}

function retry(): void {
  failed.value = false
  void fetchStatusOnce()
}
</script>

<template>
  <div data-testid="cert-extraction-step" class="flex flex-col gap-6">
    <h1 class="font-semibold text-lg text-white">Review extracted exam details</h1>

    <div
      v-if="loading"
      data-testid="extraction-loading"
      class="rounded-lg border border-readion-background-surface bg-readion-background-elevated px-4 py-6 text-slate-400 text-sm"
    >
      Extracting exam details from the confirmed source…
    </div>

    <div
      v-else-if="errored"
      data-testid="extraction-error"
      class="flex flex-col items-start gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-6 text-sm"
    >
      <p class="text-red-300">Extraction did not produce any fields. You can retry.</p>
      <button
        type="button"
        data-testid="extraction-retry-btn"
        class="rounded-lg bg-readion-primary px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-readion-primary/90"
        @click="retry"
      >
        Retry extraction
      </button>
    </div>

    <template v-else>
      <div class="flex flex-col gap-4">
        <CertFieldRow
          v-for="key in FIELD_KEYS"
          :key="key"
          :field-key="key"
          :label="FIELD_LABELS[key]"
          :field="fieldOf(key)"
          :domains="state.fieldValues.domains"
          :numeric-value="numericValueOf(key)"
          :review="reviewState[key]"
          @edit="(value) => onEdit(key, value)"
          @flag="flag(key)"
          @confirm="confirmField(key)"
        />
      </div>

      <div class="flex flex-col gap-3">
        <h2 class="font-medium text-slate-100 text-sm">Certification identity</h2>

        <label for="cert-name" class="font-mono text-slate-400 text-xs uppercase tracking-wide">
          Name
        </label>
        <input
          id="cert-name"
          v-model="state.identity.name"
          data-testid="cert-name-input"
          class="rounded-lg border border-readion-background-surface bg-readion-background-elevated px-3 py-2 text-slate-100 text-sm"
        />

        <label for="cert-provider" class="font-mono text-slate-400 text-xs uppercase tracking-wide">
          Provider
        </label>
        <input
          id="cert-provider"
          v-model="state.identity.provider"
          data-testid="cert-provider-input"
          class="rounded-lg border border-readion-background-surface bg-readion-background-elevated px-3 py-2 text-slate-100 text-sm"
        />

        <label for="cert-code" class="font-mono text-slate-400 text-xs uppercase tracking-wide">
          Code
        </label>
        <input
          id="cert-code"
          v-model="state.identity.code"
          data-testid="cert-code-input"
          class="rounded-lg border border-readion-background-surface bg-readion-background-elevated px-3 py-2 text-slate-100 text-sm"
        />
      </div>
    </template>
  </div>
</template>
