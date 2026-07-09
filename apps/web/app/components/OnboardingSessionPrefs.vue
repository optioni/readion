<script setup lang="ts">
import type { SessionDefaults } from '@readion/shared'
import {
  DEFAULT_SESSION_DEFAULTS,
  sessionDefaultContentMixes,
  sessionDefaultContentMixLabels,
  sessionDefaultDifficulties,
  sessionDefaultDifficultyLabels,
  sessionDefaultDurations,
  sessionDefaultFocusAreas,
  sessionDefaultLearningStyleLabels,
  sessionDefaultLearningStyles,
  sessionDefaultsSchema,
} from '@readion/shared'
import { useQuery } from '@tanstack/vue-query'
import { reactive, watch } from 'vue'
import { onboardingQueryKeys } from '~/composables/onboardingQueryKeys'
import { readProfileEnvelope } from '~/composables/useOnboardingGate'
import { usersControllerGetMe } from '~~/src/api/users/users'

withDefaults(defineProps<{ showConfirm?: boolean }>(), { showConfirm: true })

const emit = defineEmits<{
  confirm: [defaults: SessionDefaults]
  update: [defaults: SessionDefaults]
}>()

const profileQuery = useQuery({
  queryKey: onboardingQueryKeys.profile(),
  queryFn: async () => readProfileEnvelope(await usersControllerGetMe()),
})

const selected = reactive<SessionDefaults>({ ...DEFAULT_SESSION_DEFAULTS })

watch(
  () => profileQuery.data.value?.sessionDefaults,
  (defaults) => {
    if (defaults) {
      Object.assign(selected, defaults)
    }
  },
  { immediate: true },
)

watch(
  selected,
  () => {
    emit('update', sessionDefaultsSchema.parse({ ...selected }))
  },
  { deep: true, immediate: true },
)

const fields = [
  {
    key: 'duration' as const,
    label: 'Session length',
    testidPrefix: 'duration-option',
    options: sessionDefaultDurations,
  },
  {
    key: 'contentMix' as const,
    label: 'Content mix',
    testidPrefix: 'content-mix',
    options: sessionDefaultContentMixes,
  },
  {
    key: 'difficulty' as const,
    label: 'Difficulty',
    testidPrefix: 'difficulty',
    options: sessionDefaultDifficulties,
  },
  {
    key: 'focusArea' as const,
    label: 'Focus area',
    testidPrefix: 'focus-area',
    options: sessionDefaultFocusAreas,
  },
  {
    key: 'learningStyle' as const,
    label: 'Learning style',
    testidPrefix: 'learning-style',
    options: sessionDefaultLearningStyles,
  },
]

const optionLabels: Partial<Record<keyof SessionDefaults, Record<string, string>>> = {
  contentMix: sessionDefaultContentMixLabels,
  difficulty: sessionDefaultDifficultyLabels,
  learningStyle: sessionDefaultLearningStyleLabels,
}

function labelFor(key: keyof SessionDefaults, option: SessionDefaults[keyof SessionDefaults]) {
  return optionLabels[key]?.[String(option)] ?? String(option)
}

function isSelected(key: keyof SessionDefaults, value: SessionDefaults[keyof SessionDefaults]) {
  return selected[key] === value
}

function select(key: keyof SessionDefaults, value: SessionDefaults[keyof SessionDefaults]) {
  Object.assign(selected, { [key]: value })
}

function confirm() {
  emit('confirm', sessionDefaultsSchema.parse({ ...selected }))
}
</script>

<template>
  <div data-testid="onboarding-session-prefs" class="flex flex-col gap-6">
    <div v-for="field in fields" :key="field.key" class="flex flex-col gap-2">
      <span class="font-mono text-slate-400 text-xs uppercase tracking-wide">
        {{ field.label }}
      </span>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="option in field.options"
          :key="String(option)"
          type="button"
          :data-testid="`${field.testidPrefix}-${option}`"
          :aria-pressed="isSelected(field.key, option)"
          class="rounded-lg border px-4 py-2 text-sm transition-colors"
          :class="
            isSelected(field.key, option)
              ? 'border-readion-primary bg-readion-primary text-white'
              : 'border-readion-background-surface bg-readion-background-elevated text-slate-200 hover:border-readion-primary'
          "
          @click="select(field.key, option)"
        >
          {{ labelFor(field.key, option) }}
        </button>
      </div>
    </div>

    <button
      v-if="showConfirm"
      type="button"
      class="self-end rounded-lg bg-readion-primary px-5 py-2.5 font-medium text-sm text-white transition-colors hover:bg-readion-primary/90"
      @click="confirm"
    >
      Confirm
    </button>
  </div>
</template>
