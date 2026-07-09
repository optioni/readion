<script setup lang="ts">
import type { SessionDefaults } from '@readion/shared'
import { DEFAULT_SESSION_DEFAULTS, sessionDefaultsSchema } from '@readion/shared'
import { useQueryClient } from '@tanstack/vue-query'
import { ref } from 'vue'
import { ReadionProblemDetailsError } from '~/api/mutator'
import FormActions from '~/components/FormActions.vue'
import OnboardingSessionPrefs from '~/components/OnboardingSessionPrefs.vue'
import { settingsQueryKeys } from '~/composables/settingsQueryKeys'
import { usersControllerUpdateMe } from '~~/src/api/users/users'

const queryClient = useQueryClient()

const selected = ref<SessionDefaults>({ ...DEFAULT_SESSION_DEFAULTS })
const saving = ref(false)
const errorMessage = ref<string | null>(null)

function trackSelection(defaults: SessionDefaults) {
  selected.value = defaults
}

async function saveDefaults() {
  errorMessage.value = null
  const sessionDefaults = sessionDefaultsSchema.parse(selected.value)

  saving.value = true
  try {
    await usersControllerUpdateMe({ sessionDefaults })
    await queryClient.invalidateQueries({ queryKey: settingsQueryKeys.profile() })
  } catch (error) {
    errorMessage.value =
      error instanceof ReadionProblemDetailsError
        ? (error.detail ?? error.title)
        : 'Could not save your study defaults. Please try again.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <OnboardingSessionPrefs
      :show-confirm="false"
      layout="settings"
      @update="trackSelection"
    />

    <p v-if="errorMessage" data-testid="study-defaults-error" class="text-red-400 text-sm">
      {{ errorMessage }}
    </p>

    <FormActions>
      <button
        type="button"
        data-testid="save-defaults-btn"
        :disabled="saving"
        class="rounded-lg bg-readion-primary px-5 py-2.5 font-medium text-sm text-white transition-colors hover:bg-readion-primary/90 disabled:opacity-60"
        @click="saveDefaults"
      >
        Save defaults
      </button>
    </FormActions>
  </div>
</template>
