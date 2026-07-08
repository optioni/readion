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
    class="flex flex-col gap-4 rounded-xl border border-readion-primary/20 bg-readion-primary/[0.06] p-5"
  >
    <div class="flex items-center gap-3">
      <svg
        data-testid="diagnostic-reprompt-icon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        class="flex-shrink-0 text-readion-primary-300"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
      <p class="text-slate-200 text-sm">
        Take a 2-minute diagnostic to personalize your first session
      </p>
    </div>
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
