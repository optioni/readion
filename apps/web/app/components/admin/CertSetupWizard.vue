<script setup lang="ts">
import { computed } from 'vue'
import CertSetupConfirmStep from '~/components/admin/CertSetupConfirmStep.vue'
import CertSetupCoverage from '~/components/admin/CertSetupCoverage.vue'
import CertSetupExtractionStep from '~/components/admin/CertSetupExtractionStep.vue'
import CertSetupIdentifyStep from '~/components/admin/CertSetupIdentifyStep.vue'
import CertSetupReviewStep from '~/components/admin/CertSetupReviewStep.vue'
import CertSetupSourcesStep from '~/components/admin/CertSetupSourcesStep.vue'
import SetupHeader from '~/components/admin/SetupHeader.vue'
import { useCertSetupWizard } from '~/composables/useCertSetupWizard'

// Owns the shared wizard state (see CertSetupWizardState). The fix-web-admin-parity restructure
// splits step 1 into a standalone "Identify certification" screen (step 1) and a separate source
// confirmation screen (step 2); step 3 (extraction review + draft submit) is kept intact as one
// view so the admin reviews and submits without an extra navigation; a successful create advances
// to step 4 (read-only coverage + sources registration).
const {
  state,
  submitIdentity,
  confirmSource,
  applyExtraction,
  editFieldValue,
  flagField,
  registerCreatedDraft,
} = useCertSetupWizard()

const headerCode = computed(() => state.identity.code || state.code)
const headerCertName = computed(() => state.identity.name || state.name)

// Cancel exits the wizard without creating a draft — plain navigation, no discover/create call.
function cancelSetup(): void {
  navigateTo('/admin/certifications')
}
</script>

<template>
  <div data-testid="admin-cert-setup-page" class="flex flex-col gap-6">
    <SetupHeader :step="state.step" :code="headerCode" :cert-name="headerCertName" @cancel="cancelSetup" />

    <CertSetupIdentifyStep v-if="state.step === 1" :state="state" :submit-identity="submitIdentity" />

    <CertSetupConfirmStep v-else-if="state.step === 2" :state="state" :confirm-source="confirmSource" />

    <template v-else-if="state.step === 3">
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
