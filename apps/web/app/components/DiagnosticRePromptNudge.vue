<script setup lang="ts">
import type { DiagnosticOfferResponse } from '@readion/shared'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { onboardingQueryKeys } from '~/composables/onboardingQueryKeys'
import { useOnboardingActions } from '~/composables/useOnboardingActions'
import {
  diagnosticControllerDismissOffer,
  diagnosticControllerGetOffer,
} from '~~/src/api/diagnostic/diagnostic'

const props = defineProps<{ enrollmentId: string }>()

const queryClient = useQueryClient()
const { takeDiagnostic } = useOnboardingActions()

const readOfferEnvelope = (response: { data: unknown }): DiagnosticOfferResponse =>
  (response.data as { data: DiagnosticOfferResponse }).data

const offerQuery = useQuery({
  queryKey: onboardingQueryKeys.diagnosticOffer(props.enrollmentId),
  queryFn: async () => readOfferEnvelope(await diagnosticControllerGetOffer(props.enrollmentId)),
})

async function skip() {
  await diagnosticControllerDismissOffer(props.enrollmentId)
  await queryClient.invalidateQueries({
    queryKey: onboardingQueryKeys.diagnosticOffer(props.enrollmentId),
  })
}
</script>

<template>
  <div
    v-if="offerQuery.data.value?.offer === 're-prompt'"
    data-testid="diagnostic-reprompt"
    class="flex flex-col gap-4 rounded-xl border border-readion-background-surface bg-readion-background-elevated p-5"
  >
    <p class="text-slate-200 text-sm">
      Take a 2-minute diagnostic to personalize your first session
    </p>
    <div class="flex items-center justify-end gap-3">
      <button
        type="button"
        data-testid="diagnostic-reprompt-skip"
        class="rounded-lg px-4 py-2 font-medium text-slate-400 text-sm transition-colors hover:text-slate-200"
        @click="skip"
      >
        Skip
      </button>
      <button
        type="button"
        data-testid="diagnostic-reprompt-take"
        class="rounded-lg bg-readion-primary px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-readion-primary-hover"
        @click="takeDiagnostic(props.enrollmentId)"
      >
        Take
      </button>
    </div>
  </div>
</template>
