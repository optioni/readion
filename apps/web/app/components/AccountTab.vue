<script setup lang="ts">
import { forgotPasswordRequestSchema, updateUserProfileRequestSchema } from '@readion/shared'
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import { ReadionProblemDetailsError } from '~/api/mutator'
import { settingsQueryKeys } from '~/composables/settingsQueryKeys'
import { useSettingsProfile } from '~/composables/useSettingsProfile'
import { authControllerForgotPassword } from '~~/src/api/auth/auth'
import { usersControllerUpdateMe } from '~~/src/api/users/users'

const jsonHeaders = { 'Content-Type': 'application/json' }

const queryClient = useQueryClient()
const profileQuery = useSettingsProfile()

const email = computed(() => profileQuery.data.value?.email ?? '')

const initials = computed(() => {
  const localPart = email.value.split('@')[0] ?? ''
  const letters = localPart.replace(/[^a-zA-Z]/g, '').slice(0, 2)
  return (letters || email.value.slice(0, 2)).toUpperCase()
})

const timeZones = Intl.supportedValuesOf('timeZone')

const selectedTimezone = ref('')
const saving = ref(false)
const errorMessage = ref<string | null>(null)

watch(
  () => profileQuery.data.value?.displayTimezone,
  (displayTimezone) => {
    if (displayTimezone) {
      selectedTimezone.value = displayTimezone
    }
  },
  { immediate: true },
)

async function saveTimezone() {
  errorMessage.value = null
  const body = updateUserProfileRequestSchema.parse({ displayTimezone: selectedTimezone.value })

  saving.value = true
  try {
    await usersControllerUpdateMe({ headers: jsonHeaders, body: JSON.stringify(body) })
    await queryClient.invalidateQueries({ queryKey: settingsQueryKeys.profile() })
  } catch (error) {
    errorMessage.value =
      error instanceof ReadionProblemDetailsError
        ? (error.detail ?? error.title)
        : 'Could not save your timezone. Please try again.'
  } finally {
    saving.value = false
  }
}

const requestingReset = ref(false)
const resetRequested = ref(false)
const resetError = ref<string | null>(null)

async function requestPasswordReset() {
  resetError.value = null
  const body = forgotPasswordRequestSchema.parse({ email: email.value })

  requestingReset.value = true
  try {
    await authControllerForgotPassword({ headers: jsonHeaders, body: JSON.stringify(body) })
    resetRequested.value = true
  } catch (error) {
    resetError.value =
      error instanceof ReadionProblemDetailsError
        ? (error.detail ?? error.title)
        : 'Could not send a reset link. Please try again.'
  } finally {
    requestingReset.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-8">
    <section class="flex flex-col gap-5">
      <h2 class="font-medium text-slate-100 text-sm">Profile</h2>

      <div class="flex items-center gap-4">
        <div
          data-testid="account-avatar"
          class="flex size-12 items-center justify-center rounded-full bg-readion-primary font-medium text-sm text-white"
        >
          {{ initials }}
        </div>
        <div class="flex flex-col gap-1">
          <span class="font-mono text-slate-400 text-xs uppercase tracking-wide">Email</span>
          <span data-testid="account-email" class="text-slate-100 text-sm">{{ email }}</span>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <label
          for="timezone-select"
          class="font-mono text-slate-400 text-xs uppercase tracking-wide"
        >
          Display timezone
        </label>
        <select
          id="timezone-select"
          v-model="selectedTimezone"
          data-testid="timezone-select"
          class="rounded-lg border border-readion-background-surface bg-readion-background-elevated px-3 py-2 text-slate-100 text-sm"
        >
          <option v-for="zone in timeZones" :key="zone" :value="zone">{{ zone }}</option>
        </select>

        <p v-if="errorMessage" data-testid="timezone-error" class="text-red-400 text-sm">
          {{ errorMessage }}
        </p>

        <button
          type="button"
          data-testid="save-timezone-btn"
          :disabled="saving"
          class="self-start rounded-lg bg-readion-primary px-5 py-2.5 font-medium text-sm text-white transition-colors hover:bg-readion-primary/90 disabled:opacity-60"
          @click="saveTimezone"
        >
          Save
        </button>
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="font-medium text-slate-100 text-sm">Password</h2>
      <p class="text-slate-400 text-sm">
        We'll email a secure reset link to your account address. No passwords are entered here.
      </p>

      <p v-if="resetError" data-testid="reset-error" class="text-red-400 text-sm">
        {{ resetError }}
      </p>

      <p
        v-if="resetRequested"
        data-testid="reset-link-confirmation"
        class="text-emerald-400 text-sm"
      >
        Check your inbox — we've emailed a secure reset link to {{ email }}.
      </p>

      <button
        type="button"
        data-testid="request-reset-btn"
        :disabled="requestingReset"
        class="self-start rounded-lg border border-readion-background-surface bg-readion-background-elevated px-5 py-2.5 font-medium text-slate-100 text-sm transition-colors hover:bg-readion-background-surface disabled:opacity-60"
        @click="requestPasswordReset"
      >
        Change password / Email me a reset link
      </button>
    </section>
  </div>
</template>
