<script setup lang="ts">
import CertSetupExtractionStep from '~/components/admin/CertSetupExtractionStep.vue'
import CertSetupSourceStep from '~/components/admin/CertSetupSourceStep.vue'
import { useCertSetupWizard } from '~/composables/useCertSetupWizard'

// Owns the shared wizard state (see CertSetupWizardState). Step 1 (group 6) and step 2
// (group 7 — extraction review) are rendered here; group 8 fills the `step >= 3`
// placeholder (sources/coverage + draft submit), reading the same `state` instance —
// `state.fieldValues`, `state.identity`, `state.manualFields`, `state.confirmedSourceUrl`.
const { state, confirmSource, applyExtraction, editFieldValue, flagField } = useCertSetupWizard()
</script>

<template>
  <div data-testid="admin-cert-setup-page" class="flex flex-col gap-6">
    <CertSetupSourceStep v-if="state.step === 1" :state="state" :confirm-source="confirmSource" />

    <CertSetupExtractionStep
      v-else-if="state.step === 2"
      :state="state"
      :apply-extraction="applyExtraction"
      :edit-field-value="editFieldValue"
      :flag-field="flagField"
    />

    <!-- step 3+ rendered by group 8 (sources/coverage → draft submit) -->
    <div v-else data-testid="cert-setup-step-placeholder" />
  </div>
</template>
