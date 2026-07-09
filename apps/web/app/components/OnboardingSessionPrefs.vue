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
import { computed, reactive, watch } from 'vue'
import SettingsFieldRow from '~/components/SettingsFieldRow.vue'
import { onboardingQueryKeys } from '~/composables/onboardingQueryKeys'
import { readProfileEnvelope } from '~/composables/useOnboardingGate'
import { usersControllerGetMe } from '~~/src/api/users/users'

const props = withDefaults(
  defineProps<{ showConfirm?: boolean; layout?: 'onboarding' | 'settings' }>(),
  { showConfirm: true, layout: 'onboarding' },
)

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
    settingsHint: 'Default duration per session',
  },
  {
    key: 'contentMix' as const,
    label: 'Content mix',
    testidPrefix: 'content-mix',
    options: sessionDefaultContentMixes,
    settingsHint: undefined,
  },
  {
    key: 'difficulty' as const,
    label: 'Difficulty',
    testidPrefix: 'difficulty',
    options: sessionDefaultDifficulties,
    settingsHint: undefined,
  },
  {
    key: 'focusArea' as const,
    label: 'Focus area',
    testidPrefix: 'focus-area',
    options: sessionDefaultFocusAreas,
    settingsHint: undefined,
  },
  {
    key: 'learningStyle' as const,
    label: 'Learning style',
    testidPrefix: 'learning-style',
    options: sessionDefaultLearningStyles,
    settingsHint: undefined,
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

const durationIndex = computed<number>({
  get: () => {
    const index = sessionDefaultDurations.indexOf(selected.duration)
    return index === -1 ? 0 : index
  },
  set: (index) => {
    const duration = sessionDefaultDurations[index]
    if (duration !== undefined) {
      selected.duration = duration
    }
  },
})

const isSettingsLayout = computed(() => props.layout === 'settings')

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
    <template v-if="isSettingsLayout">
      <SettingsFieldRow v-for="field in fields" :key="field.key" :label="field.label" :hint="field.settingsHint">
        <div v-if="field.key === 'duration'" class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <span class="text-readion-text-muted text-xs">Duration</span>
            <span
              data-testid="duration-readout"
              class="font-medium text-readion-accent-label text-sm"
            >
              {{ selected.duration }} min
            </span>
          </div>
          <input
            v-model.number="durationIndex"
            data-testid="duration-slider"
            type="range"
            min="0"
            :max="sessionDefaultDurations.length - 1"
            step="1"
            class="w-full accent-readion-primary"
          />
        </div>

        <div v-else class="flex flex-wrap gap-2">
          <button
            v-for="option in field.options"
            :key="String(option)"
            type="button"
            :data-testid="`${field.testidPrefix}-${option}`"
            :aria-pressed="isSelected(field.key, option)"
            class="rounded-full border px-4 py-1.5 font-medium text-sm transition-colors"
            :class="
              isSelected(field.key, option)
                ? 'border-readion-primary bg-readion-primary text-white'
                : 'border-readion-border-strong bg-transparent text-readion-text-secondary hover:border-readion-primary'
            "
            @click="select(field.key, option)"
          >
            {{ labelFor(field.key, option) }}
          </button>
        </div>
      </SettingsFieldRow>
    </template>

    <template v-else>
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
    </template>

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
