<script setup lang="ts">
import CertSetupCoverage from '~/components/admin/CertSetupCoverage.vue'
import CertSetupExtractionStep from '~/components/admin/CertSetupExtractionStep.vue'
import CertSetupReviewStep from '~/components/admin/CertSetupReviewStep.vue'
import CertSetupSourceStep from '~/components/admin/CertSetupSourceStep.vue'
import CertSetupSourcesStep from '~/components/admin/CertSetupSourcesStep.vue'
import { useCertSetupWizard } from '~/composables/useCertSetupWizard'

// Owns the shared wizard state (see CertSetupWizardState). Step 1 (discover) and step 2 (extraction
// review + draft submit) live in the same view so the admin reviews and submits without an extra
// navigation; a successful create advances to step 3 (read-only coverage + sources registration).
const { state, confirmSource, applyExtraction, editFieldValue, flagField, registerCreatedDraft } =
  useCertSetupWizard()
</script>

<template>
  <div data-testid="admin-cert-setup-page" class="flex flex-col gap-6">
    <CertSetupSourceStep v-if="state.step === 1" :state="state" :confirm-source="confirmSource" />

    <template v-else-if="state.step === 2">
      <CertSetupExtractionStep
        :state="state"
        :apply-extraction="applyExtraction"
        :edit-field-value="editFieldValue"
        :flag-field="flagField"
      />
      <CertSetupReviewStep :state="state" :register-created-draft="registerCreatedDraft" />
    </template>

    <template v-else-if="state.createdCertId">
      <CertSetupCoverage :cert-id="state.createdCertId" />
      <CertSetupSourcesStep :state="state" :cert-id="state.createdCertId" />
    </template>
  </div>
</template>
