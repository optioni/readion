<script setup lang="ts">
import { computed, ref } from 'vue'
import { ReadionProblemDetailsError } from '~/api/mutator'
import ReadionButton from '~/components/ReadionButton.vue'
import { readDataEnvelope } from '~/composables/adminEnvelope'
import { buildDraftCreateBody, canCreateDraft } from '~/composables/certDraftCreateBody'
import type { CertSetupWizardState } from '~/composables/useCertSetupWizard'
import { certSetupControllerCreate } from '~~/src/api/cert-setup/cert-setup'

const props = defineProps<{
  state: CertSetupWizardState
  registerCreatedDraft: (certId: string) => void
}>()

const jsonHeaders = { 'Content-Type': 'application/json' }

const errorMessage = ref<string | null>(null)
const submitting = ref(false)

// Draft → live is automatic; the only gate is the client-side domain weight-sum.
const canSubmit = computed(() => canCreateDraft(props.state))

async function submitDraft(): Promise<void> {
  if (!canSubmit.value || submitting.value) return
  errorMessage.value = null
  submitting.value = true
  try {
    const response = await certSetupControllerCreate({
      headers: jsonHeaders,
      body: JSON.stringify(buildDraftCreateBody(props.state)),
    })
    const created = readDataEnvelope<{ id: string }>(response)
    props.registerCreatedDraft(created.id)
  } catch (error) {
    errorMessage.value =
      error instanceof ReadionProblemDetailsError
        ? (error.detail ?? error.title)
        : 'Could not create the certification.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <ReadionButton
      data-testid="submit-draft-btn"
      :disabled="!canSubmit || submitting"
      :busy="submitting"
      busy-label="Creating…"
      class="self-start px-5 py-2.5"
      @click="submitDraft"
    >
      Create draft certification
    </ReadionButton>

    <p v-if="errorMessage" data-testid="submit-draft-error" class="text-red-400 text-sm">
      {{ errorMessage }}
    </p>
  </div>
</template>
