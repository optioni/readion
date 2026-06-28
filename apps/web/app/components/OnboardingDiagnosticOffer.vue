<script setup lang="ts">
import type { DiagnosticOfferResponse } from '@readion/shared'
import { useQuery } from '@tanstack/vue-query'
import { watch } from 'vue'
import { onboardingQueryKeys } from '~/composables/onboardingQueryKeys'
import { useOnboardingActions } from '~/composables/useOnboardingActions'
import { diagnosticControllerGetOffer } from '~~/src/api/diagnostic/diagnostic'

const props = defineProps<{ enrollmentId: string }>()

const { takeDiagnostic, skipDiagnostic } = useOnboardingActions()

const readOfferEnvelope = (response: { data: unknown }): DiagnosticOfferResponse =>
  (response.data as { data: DiagnosticOfferResponse }).data

const offerQuery = useQuery({
  queryKey: onboardingQueryKeys.diagnosticOffer(props.enrollmentId),
  queryFn: async () => readOfferEnvelope(await diagnosticControllerGetOffer(props.enrollmentId)),
})

watch(
  () => offerQuery.data.value?.offer,
  (offer) => {
    if (offer === 'none') {
      navigateTo('/')
    }
  },
  { immediate: true },
)
</script>

<template>
  <div
    v-if="offerQuery.data.value?.offer === 'onboarding'"
    data-testid="diagnostic-offer"
    class="flex flex-col gap-6 rounded-xl border border-readion-background-surface bg-readion-background-elevated p-6"
  >
    <p class="text-base text-slate-200">
      Take a 2-minute diagnostic to personalize your first session
    </p>
    <div class="flex items-center justify-end gap-3">
      <button
        type="button"
        data-testid="diagnostic-offer-skip"
        class="rounded-lg px-5 py-2.5 font-medium text-slate-400 text-sm transition-colors hover:text-slate-200"
        @click="skipDiagnostic(props.enrollmentId)"
      >
        Skip
      </button>
      <button
        type="button"
        data-testid="diagnostic-offer-take"
        class="rounded-lg bg-readion-primary px-5 py-2.5 font-medium text-sm text-white transition-colors hover:bg-readion-primary-hover"
        @click="takeDiagnostic(props.enrollmentId)"
      >
        Take
      </button>
    </div>
  </div>
</template>
