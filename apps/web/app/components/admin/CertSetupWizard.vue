<script setup lang="ts">
import CertSetupSourceStep from '~/components/admin/CertSetupSourceStep.vue'
import { useCertSetupWizard } from '~/composables/useCertSetupWizard'

// Owns the shared wizard state (see CertSetupWizardState). Step 1 is rendered here;
// groups 7 (extraction) and 8 (sources/coverage + draft submit) fill the `step >= 2`
// branch below, reading `state.confirmedSourceUrl`, `state.extractionJobId`,
// `state.name` and `state.code` from the same `state` instance.
const { state, confirmSource } = useCertSetupWizard()
</script>

<template>
  <div data-testid="admin-cert-setup-page" class="flex flex-col gap-6">
    <CertSetupSourceStep v-if="state.step === 1" :state="state" :confirm-source="confirmSource" />

    <!-- step 2+ rendered by groups 7/8 (extraction → sources/coverage → draft submit) -->
    <div v-else data-testid="cert-setup-step-placeholder" />
  </div>
</template>
