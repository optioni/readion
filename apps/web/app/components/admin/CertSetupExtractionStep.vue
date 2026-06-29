<script setup lang="ts">
import type {
  CertExtractionFields,
  CertificationFieldCitation,
  ExtractedField,
} from '@readion/shared'
import { useQuery } from '@tanstack/vue-query'
import { computed, reactive, watch } from 'vue'
import { readExtractionStatusEnvelope } from '~/composables/adminEnvelope'
import { adminQueryKeys } from '~/composables/adminQueryKeys'
import { isTerminalWithoutFields, nextRefetchInterval } from '~/composables/certExtractionPoll'
import type { CertExtractionFieldKey, CertSetupWizardState } from '~/composables/useCertSetupWizard'
import { certSetupControllerReadExtraction } from '~~/src/api/cert-setup/cert-setup'

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

const extractionQuery = useQuery({
  queryKey: computed(() => adminQueryKeys.extraction(props.state.extractionJobId ?? '')),
  queryFn: async () =>
    readExtractionStatusEnvelope(
      await certSetupControllerReadExtraction(props.state.extractionJobId as string),
    ),
  enabled: computed(() => Boolean(props.state.extractionJobId) && props.state.step === 2),
  refetchInterval: (query) => nextRefetchInterval(query.state.data),
})

watch(
  () => extractionQuery.data.value,
  (data) => {
    if (data?.fields) props.applyExtraction(data.fields)
  },
  { immediate: true },
)

const ready = computed(() => Boolean(props.state.fields))
const errored = computed(() => isTerminalWithoutFields(extractionQuery.data.value ?? undefined))
const loading = computed(() => !ready.value && !errored.value)

function fieldOf(key: CertExtractionFieldKey): ExtractedField<unknown> | null {
  return props.state.fields ? props.state.fields[key] : null
}

function isGrounded(field: ExtractedField<unknown> | null): boolean {
  return Boolean(field) && 'citation' in (field as object)
}

function citationOf(key: CertExtractionFieldKey): CertificationFieldCitation | null {
  const field = fieldOf(key)
  return field && 'citation' in field ? field.citation : null
}

function numericValue(key: NumericKey): number | null {
  return props.state.fieldValues[key]
}

function onNumericInput(key: NumericKey, event: Event): void {
  const raw = (event.target as HTMLInputElement).value
  props.editFieldValue(key, raw === '' ? null : Number(raw))
}

function confirmField(key: CertExtractionFieldKey): void {
  reviewState[key] = 'confirmed'
}

function flag(key: CertExtractionFieldKey): void {
  reviewState[key] = 'flagged'
  props.flagField(key)
}

function retry(): void {
  extractionQuery.refetch()
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
        <div
          v-for="key in FIELD_KEYS"
          :key="key"
          :data-testid="`extraction-field-${key}`"
          :data-review="reviewState[key] ?? 'pending'"
          class="flex flex-col gap-2 rounded-lg border border-readion-background-surface bg-readion-background-elevated px-4 py-3"
        >
          <span class="font-mono text-slate-400 text-xs uppercase tracking-wide">
            {{ FIELD_LABELS[key] }}
          </span>

          <template v-if="isGrounded(fieldOf(key))">
            <div v-if="key === 'domains'" class="flex flex-col gap-1">
              <span
                v-for="domain in state.fieldValues.domains ?? []"
                :key="domain.name"
                class="text-slate-100 text-sm"
              >
                {{ domain.name }} — {{ domain.weight }}%
              </span>
            </div>
            <div v-else class="flex items-center gap-3">
              <span data-testid="field-value" class="font-medium text-slate-100 text-sm">
                {{ numericValue(key as NumericKey) }}
              </span>
              <input
                data-testid="field-value-input"
                type="number"
                :value="numericValue(key as NumericKey)"
                class="w-24 rounded-lg border border-readion-background-surface bg-readion-background-base px-2 py-1 text-slate-100 text-sm"
                @input="onNumericInput(key as NumericKey, $event)"
              />
            </div>

            <div
              data-testid="field-citation"
              class="flex flex-col gap-1 rounded-lg bg-readion-background-base px-3 py-2"
            >
              <span class="text-slate-300 text-xs italic">“{{ citationOf(key)?.passage }}”</span>
              <a
                :href="citationOf(key)?.url"
                class="break-all text-readion-primary text-xs"
                target="_blank"
                rel="noreferrer"
              >
                {{ citationOf(key)?.url }}
              </a>
            </div>
          </template>

          <template v-else>
            <p class="text-amber-300 text-sm">unverified — confirm manually</p>
            <input
              v-if="key !== 'domains'"
              data-testid="field-value-input"
              type="number"
              :value="numericValue(key as NumericKey)"
              placeholder="Enter value"
              class="w-24 rounded-lg border border-readion-background-surface bg-readion-background-base px-2 py-1 text-slate-100 text-sm"
              @input="onNumericInput(key as NumericKey, $event)"
            />
          </template>

          <div class="flex gap-2">
            <button
              type="button"
              data-testid="field-confirm-btn"
              class="rounded-lg border border-readion-background-surface px-3 py-1 text-slate-300 text-xs transition-colors hover:bg-readion-background-surface"
              @click="confirmField(key)"
            >
              Confirm
            </button>
            <button
              type="button"
              data-testid="field-flag-btn"
              class="rounded-lg border border-amber-500/40 px-3 py-1 text-amber-300 text-xs transition-colors hover:bg-amber-500/10"
              @click="flag(key)"
            >
              Flag as uncertain
            </button>
          </div>
        </div>
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
