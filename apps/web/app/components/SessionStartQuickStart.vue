<script setup lang="ts">
import type { SessionDefaults } from '@readion/shared'
import {
  sessionDefaultContentMixLabels,
  sessionDefaultDifficultyLabels,
  sessionDefaultLearningStyleLabels,
} from '@readion/shared'
import { useQuery } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import ReadionButton from '~/components/ReadionButton.vue'
import { onboardingQueryKeys } from '~/composables/onboardingQueryKeys'
import { sessionRunPath } from '~/composables/runnerRoutes'
import { createSession } from '~/composables/sessionViewApi'
import { useCertDetail } from '~/composables/useCertDetail'
import { useCertWeakAreas } from '~/composables/useCertWeakAreas'
import { readProfileEnvelope } from '~/composables/useOnboardingGate'
import { usersControllerGetMe } from '~~/src/api/users/users'

const props = defineProps<{ enrollmentId: string }>()
defineEmits<{ customise: [] }>()

const profileQuery = useQuery({
  queryKey: onboardingQueryKeys.profile(),
  queryFn: async () => readProfileEnvelope(await usersControllerGetMe()),
})

const defaults = computed<SessionDefaults | null>(
  () => profileQuery.data.value?.sessionDefaults ?? null,
)

const summaryRows = computed(() => {
  const value = defaults.value
  if (!value) {
    return []
  }
  return [
    { label: 'Duration', value: `${value.duration} min` },
    { label: 'Content mix', value: sessionDefaultContentMixLabels[value.contentMix] },
    { label: 'Difficulty', value: sessionDefaultDifficultyLabels[value.difficulty] },
    { label: 'Learning style', value: sessionDefaultLearningStyleLabels[value.learningStyle] },
  ]
})

const { name: certName, code: certCode } = useCertDetail(props.enrollmentId)
const { weakAreas } = useCertWeakAreas(props.enrollmentId)

const suggestedDomain = computed(() => {
  if (weakAreas.value.length === 0) {
    return null
  }
  return weakAreas.value.reduce((lowest, area) => (area.score < lowest.score ? area : lowest))
})

const isStarting = ref(false)
const startError = ref<string | null>(null)

async function start() {
  if (isStarting.value) {
    return
  }
  startError.value = null
  isStarting.value = true
  try {
    const session = await createSession(props.enrollmentId)
    await navigateTo(sessionRunPath(session.data.id))
  } catch {
    startError.value = 'Couldn’t start the session. Try again.'
    isStarting.value = false
  }
}
</script>

<template>
  <div data-testid="quick-start-panel" class="mx-auto flex w-full max-w-[480px] flex-col">
    <div class="mb-7 flex justify-center">
      <div
        data-testid="cert-identity-pill"
        class="flex items-center gap-2 rounded-full border border-readion-border-strong bg-readion-background-surface px-3.5 py-1.5"
      >
        <span class="font-mono text-[11px] text-readion-accent-label uppercase">{{ certCode }}</span>
        <span class="text-readion-text-secondary text-xs">{{ certName }}</span>
      </div>
    </div>

    <div
      class="mb-3 rounded-xl border border-readion-border-strong bg-readion-background-surface px-8 py-7"
    >
      <p class="mb-1 text-center font-bold text-slate-100 text-xl">Ready to start?</p>
      <p class="mb-6 text-center text-readion-text-muted text-sm">Using your saved defaults</p>

      <div
        data-testid="quick-start-defaults"
        class="mb-6 rounded-lg border border-readion-border-default bg-readion-background-base px-4 py-3"
      >
        <div
          v-for="row in summaryRows"
          :key="row.label"
          class="flex justify-between border-readion-border-default border-b py-1.5 last:border-b-0"
        >
          <span class="text-readion-text-muted text-xs">{{ row.label }}</span>
          <span class="font-medium text-slate-200 text-xs">{{ row.value }}</span>
        </div>
      </div>

      <div
        v-if="suggestedDomain"
        data-testid="suggested-focus-banner"
        class="mb-6 flex items-center gap-2.5 rounded-lg border border-readion-status-poor/20 bg-readion-status-poor/[0.06] px-3 py-2.5"
      >
        <span class="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-readion-status-poor" />
        <span class="text-slate-300 text-xs">
          Readion will prioritise
          <span class="font-medium text-slate-100">{{ suggestedDomain.domain }}</span>
          — your weakest domain ({{ suggestedDomain.score }}%)
        </span>
      </div>

      <ReadionButton
        data-testid="quick-start-button"
        class="w-full py-3"
        :busy="isStarting"
        busy-label="Starting…"
        @click="start"
      >
        Start session &#8594;
      </ReadionButton>
      <p
        v-if="startError"
        data-testid="quick-start-error"
        class="mt-3 text-readion-status-poor text-sm"
        role="alert"
      >
        {{ startError }}
      </p>
    </div>

    <div class="text-center">
      <button
        type="button"
        data-testid="customise-link"
        class="text-readion-accent-label text-sm hover:underline"
        @click="$emit('customise')"
      >
        Customise this session
      </button>
    </div>
  </div>
</template>
