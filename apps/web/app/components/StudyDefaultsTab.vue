<script setup lang="ts">
import type { SessionDefaults } from '@readion/shared'
import { DEFAULT_SESSION_DEFAULTS, sessionDefaultsSchema } from '@readion/shared'
import { useQueryClient } from '@tanstack/vue-query'
import { ref } from 'vue'
import { ReadionProblemDetailsError } from '~/api/mutator'
import FormActions from '~/components/FormActions.vue'
import OnboardingSessionPrefs from '~/components/OnboardingSessionPrefs.vue'
import ReadionButton from '~/components/ReadionButton.vue'
import { settingsQueryKeys } from '~/composables/settingsQueryKeys'
import { usersControllerUpdateMe } from '~~/src/api/users/users'

const queryClient = useQueryClient()

const selected = ref<SessionDefaults>({ ...DEFAULT_SESSION_DEFAULTS })
const saving = ref(false)
const errorMessage = ref<string | null>(null)
const saved = ref(false)

function trackSelection(defaults: SessionDefaults) {
  selected.value = defaults
}

async function saveDefaults() {
  if (saving.value) {
    return
  }
  errorMessage.value = null
  saved.value = false
  const sessionDefaults = sessionDefaultsSchema.parse(selected.value)

  saving.value = true
  try {
    await usersControllerUpdateMe({ sessionDefaults })
    await queryClient.invalidateQueries({ queryKey: settingsQueryKeys.profile() })
    saved.value = true
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
  <div class="flex w-full min-w-0 flex-col gap-6">
    <div>
      <h2
        data-testid="study-defaults-title"
        class="mb-1 font-medium text-readion-text-primary text-sm"
      >
        Session preferences
      </h2>
      <p
        data-testid="study-defaults-intro"
        class="mb-5 text-readion-text-secondary text-sm leading-relaxed"
      >
        These are your default starting values for each new session. Readion adjusts them over
        time based on your performance.
      </p>
    </div>

    <OnboardingSessionPrefs
      :show-confirm="false"
      layout="settings"
      @update="trackSelection"
    />

    <p
      v-if="errorMessage"
      data-testid="study-defaults-error"
      class="break-words text-readion-status-poor text-sm"
      role="alert"
    >
      {{ errorMessage }}
    </p>

    <FormActions>
      <ReadionButton
        data-testid="save-defaults-btn"
        :busy="saving"
        busy-label="Saving…"
        @click="saveDefaults"
      >
        Save defaults
      </ReadionButton>
    </FormActions>

    <p
      v-if="saved"
      data-testid="study-defaults-confirmation"
      class="text-readion-status-good text-sm"
      role="status"
    >
      Study defaults saved.
    </p>
  </div>
</template>
