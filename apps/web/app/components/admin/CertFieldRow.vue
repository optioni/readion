<script setup lang="ts">
import type {
  CertificationDomain,
  CertificationFieldCitation,
  ExtractedField,
} from '@readion/shared'
import { computed } from 'vue'
import CitationPanel from '~/components/admin/CitationPanel.vue'
import type { CertExtractionFieldKey } from '~/composables/useCertSetupWizard'

const props = defineProps<{
  fieldKey: CertExtractionFieldKey
  label: string
  field: ExtractedField<unknown>
  domains: CertificationDomain[] | null
  numericValue: number | null
  review: 'confirmed' | 'flagged' | undefined
}>()

const emit = defineEmits<{
  edit: [value: number | null]
  flag: []
  confirm: []
}>()

const grounded = computed(() => 'citation' in props.field)
const isDomains = computed(() => props.fieldKey === 'domains')
const citation = computed<CertificationFieldCitation | null>(() =>
  'citation' in props.field ? props.field.citation : null,
)

function onInput(event: Event): void {
  const raw = (event.target as HTMLInputElement).value
  emit('edit', raw === '' ? null : Number(raw))
}
</script>

<template>
  <div
    :data-testid="`extraction-field-${fieldKey}`"
    :data-review="review ?? 'pending'"
    class="flex flex-col gap-2 rounded-lg border border-readion-background-surface bg-readion-background-elevated px-4 py-3"
  >
    <span class="font-mono text-slate-400 text-xs uppercase tracking-wide">{{ label }}</span>

    <template v-if="grounded">
      <div v-if="isDomains" class="flex flex-col gap-1">
        <span v-for="domain in domains ?? []" :key="domain.name" class="text-slate-100 text-sm">
          {{ domain.name }} — {{ domain.weight }}%
        </span>
      </div>
      <div v-else class="flex items-center gap-3">
        <span data-testid="field-value" class="font-medium text-slate-100 text-sm">
          {{ numericValue }}
        </span>
        <input
          data-testid="field-value-input"
          type="number"
          :value="numericValue"
          class="w-24 rounded-lg border border-readion-background-surface bg-readion-background-base px-2 py-1 text-slate-100 text-sm"
          @input="onInput"
        />
      </div>

      <CitationPanel v-if="citation" :citation="citation" />
    </template>

    <template v-else>
      <p class="text-amber-300 text-sm">unverified — confirm manually</p>
      <input
        v-if="!isDomains"
        data-testid="field-value-input"
        type="number"
        :value="numericValue"
        placeholder="Enter value"
        class="w-24 rounded-lg border border-readion-background-surface bg-readion-background-base px-2 py-1 text-slate-100 text-sm"
        @input="onInput"
      />
    </template>

    <div class="flex gap-2">
      <button
        type="button"
        data-testid="field-confirm-btn"
        class="rounded-lg border border-readion-background-surface px-3 py-1 text-slate-300 text-xs transition-colors hover:bg-readion-background-surface"
        @click="emit('confirm')"
      >
        Confirm
      </button>
      <button
        type="button"
        data-testid="field-flag-btn"
        class="rounded-lg border border-amber-500/40 px-3 py-1 text-amber-300 text-xs transition-colors hover:bg-amber-500/10"
        @click="emit('flag')"
      >
        Flag as uncertain
      </button>
    </div>
  </div>
</template>
