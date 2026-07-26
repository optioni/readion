<script setup lang="ts">
import { changePasswordRequestSchema, updateUserProfileRequestSchema } from '@readion/shared'
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import { ReadionProblemDetailsError } from '~/api/mutator'
import FormActions from '~/components/FormActions.vue'
import ReadionButton from '~/components/ReadionButton.vue'
import SettingsFieldRow from '~/components/SettingsFieldRow.vue'
import { emailInitials } from '~/composables/emailInitials'
import { settingsQueryKeys } from '~/composables/settingsQueryKeys'
import { useSettingsProfile } from '~/composables/useSettingsProfile'
import { useAuthStore } from '~/stores/auth'
import { authControllerChangePassword } from '~~/src/api/auth/auth'
import { usersControllerDeleteMe, usersControllerUpdateMe } from '~~/src/api/users/users'

const jsonHeaders = { 'Content-Type': 'application/json' }

const queryClient = useQueryClient()
const profileQuery = useSettingsProfile()

const email = computed(() => profileQuery.data.value?.email ?? '')

const initials = computed(() => emailInitials(email.value))

const timeZones = Intl.supportedValuesOf('timeZone')

const selectedTimezone = ref('')
const saving = ref(false)
const errorMessage = ref<string | null>(null)
const timezoneSaved = ref(false)

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
  if (saving.value) {
    return
  }
  errorMessage.value = null
  timezoneSaved.value = false
  const body = updateUserProfileRequestSchema.parse({ displayTimezone: selectedTimezone.value })

  saving.value = true
  try {
    await usersControllerUpdateMe(body)
    await queryClient.invalidateQueries({ queryKey: settingsQueryKeys.profile() })
    timezoneSaved.value = true
  } catch (error) {
    errorMessage.value =
      error instanceof ReadionProblemDetailsError
        ? (error.detail ?? error.title)
        : 'Could not save your timezone. Please try again.'
  } finally {
    saving.value = false
  }
}

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const changingPassword = ref(false)
const passwordChanged = ref(false)
const currentPasswordError = ref<string | null>(null)
const newPasswordError = ref<string | null>(null)
const confirmPasswordError = ref<string | null>(null)

async function changePassword() {
  if (changingPassword.value) {
    return
  }
  currentPasswordError.value = null
  newPasswordError.value = null
  confirmPasswordError.value = null
  passwordChanged.value = false

  if (confirmPassword.value !== newPassword.value) {
    confirmPasswordError.value = 'Passwords do not match.'
    return
  }

  const body = changePasswordRequestSchema.parse({
    currentPassword: currentPassword.value,
    newPassword: newPassword.value,
  })

  changingPassword.value = true
  try {
    await authControllerChangePassword({ headers: jsonHeaders, body: JSON.stringify(body) })
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    passwordChanged.value = true
  } catch (error) {
    const message =
      error instanceof ReadionProblemDetailsError
        ? (error.detail ?? error.title)
        : 'Could not change your password. Please try again.'

    if (
      error instanceof ReadionProblemDetailsError &&
      (error.status === 401 || error.status === 403)
    ) {
      currentPasswordError.value = message
    } else {
      newPasswordError.value = message
    }
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } finally {
    changingPassword.value = false
  }
}

const authStore = useAuthStore()

const deleteModalOpen = ref(false)
const deletePassword = ref('')
const deletingAccount = ref(false)
const deleteError = ref<string | null>(null)

const canConfirmDelete = computed(
  () => deletePassword.value.trim().length > 0 && !deletingAccount.value,
)

function openDeleteModal() {
  deletePassword.value = ''
  deleteError.value = null
  deleteModalOpen.value = true
}

function closeDeleteModal() {
  if (deletingAccount.value) {
    return
  }
  deleteModalOpen.value = false
}

async function confirmDeleteAccount() {
  if (!canConfirmDelete.value) {
    return
  }
  deleteError.value = null

  deletingAccount.value = true
  try {
    await usersControllerDeleteMe({ password: deletePassword.value })
    authStore.clear()
    await navigateTo('/login')
  } catch (error) {
    deleteError.value =
      error instanceof ReadionProblemDetailsError && error.status === 401
        ? 'Invalid password. Please try again.'
        : error instanceof ReadionProblemDetailsError
          ? (error.detail ?? error.title)
          : 'Could not delete your account. Please try again.'
    deletePassword.value = ''
  } finally {
    deletingAccount.value = false
  }
}
</script>

<template>
  <div class="flex w-full min-w-0 flex-col gap-8">
    <section class="flex min-w-0 flex-col gap-1">
      <h2 class="mb-3 font-medium text-slate-100 text-sm">Profile</h2>

      <SettingsFieldRow label="Avatar">
        <div
          data-testid="account-avatar"
          class="flex size-12 items-center justify-center rounded-full bg-readion-primary font-medium text-sm text-white"
        >
          {{ initials }}
        </div>
      </SettingsFieldRow>

      <SettingsFieldRow label="Email" hint="Used for login and notifications">
        <span data-testid="account-email" class="break-all text-readion-text-primary text-sm">
          {{ email }}
        </span>
      </SettingsFieldRow>

      <SettingsFieldRow label="Display timezone" for="timezone-select">
        <div class="flex flex-col gap-2">
          <select
            id="timezone-select"
            v-model="selectedTimezone"
            data-testid="timezone-select"
          class="w-full max-w-full min-w-0 truncate rounded-lg border border-readion-background-surface bg-readion-background-elevated px-3 py-2 text-readion-text-primary text-sm"
          >
            <option v-for="zone in timeZones" :key="zone" :value="zone">{{ zone }}</option>
          </select>

          <p
            v-if="errorMessage"
            data-testid="timezone-error"
            class="break-words text-readion-status-poor text-sm"
            role="alert"
          >
            {{ errorMessage }}
          </p>
        </div>
      </SettingsFieldRow>

      <FormActions>
        <ReadionButton
          data-testid="save-timezone-btn"
          :busy="saving"
          busy-label="Saving…"
          @click="saveTimezone"
        >
          Save
        </ReadionButton>
      </FormActions>
      <p
        v-if="timezoneSaved"
        data-testid="timezone-confirmation"
        class="text-readion-status-good text-sm"
        role="status"
      >
        Timezone saved.
      </p>
    </section>

    <section class="flex min-w-0 flex-col gap-1">
      <h2 class="mb-3 font-medium text-slate-100 text-sm">Password</h2>

      <SettingsFieldRow label="Current password" for="current-password">
        <div class="flex flex-col gap-2">
          <input
            id="current-password"
            v-model="currentPassword"
            type="password"
            data-testid="current-password-input"
            class="w-full min-w-0 rounded-lg border border-readion-background-surface bg-readion-background-elevated px-3 py-2 text-readion-text-primary text-sm"
          />
          <p
            v-if="currentPasswordError"
            data-testid="current-password-error"
            class="break-words text-readion-status-poor text-sm"
            role="alert"
          >
            {{ currentPasswordError }}
          </p>
        </div>
      </SettingsFieldRow>

      <SettingsFieldRow label="New password" for="new-password">
        <div class="flex flex-col gap-2">
          <input
            id="new-password"
            v-model="newPassword"
            type="password"
            data-testid="new-password-input"
            class="w-full min-w-0 rounded-lg border border-readion-background-surface bg-readion-background-elevated px-3 py-2 text-readion-text-primary text-sm"
          />
          <p
            v-if="newPasswordError"
            data-testid="new-password-error"
            class="break-words text-readion-status-poor text-sm"
            role="alert"
          >
            {{ newPasswordError }}
          </p>
        </div>
      </SettingsFieldRow>

      <SettingsFieldRow label="Confirm new password" for="confirm-password">
        <div class="flex flex-col gap-2">
          <input
            id="confirm-password"
            v-model="confirmPassword"
            type="password"
            data-testid="confirm-password-input"
            class="w-full min-w-0 rounded-lg border border-readion-background-surface bg-readion-background-elevated px-3 py-2 text-readion-text-primary text-sm"
          />
          <p
            v-if="confirmPasswordError"
            data-testid="confirm-password-error"
            class="break-words text-readion-status-poor text-sm"
            role="alert"
          >
            {{ confirmPasswordError }}
          </p>
        </div>
      </SettingsFieldRow>

      <p
        v-if="passwordChanged"
        data-testid="change-password-confirmation"
        class="text-readion-status-good text-sm"
        role="status"
      >
        Your password has been changed.
      </p>

      <FormActions>
        <ReadionButton
          data-testid="change-password-btn"
          :busy="changingPassword"
          busy-label="Updating…"
          @click="changePassword"
        >
          Update password
        </ReadionButton>
      </FormActions>
    </section>

    <section class="flex min-w-0 flex-col gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-5">
      <h2 class="font-medium text-red-300 text-sm">Danger zone</h2>
      <p class="break-words text-readion-text-secondary text-sm">
        Deleting your account is permanent. Your sessions, progress, and certifications are removed.
      </p>

      <FormActions>
        <ReadionButton
          data-testid="delete-account-btn"
          variant="destructive"
          @click="openDeleteModal"
        >
          Delete account
        </ReadionButton>
      </FormActions>
    </section>

    <div
      v-if="deleteModalOpen"
      data-testid="delete-account-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Delete account"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Close"
        class="absolute inset-0 bg-black/60"
        @click="closeDeleteModal"
      />

      <div
        class="relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-md min-w-0 overflow-y-auto rounded-xl border border-readion-background-surface bg-readion-background-elevated p-4 sm:p-6"
      >
        <h2 class="font-semibold text-slate-100 text-lg">Delete account</h2>
        <p class="mt-1 text-slate-400 text-sm">
          This action is permanent. Enter your current password to confirm.
        </p>

        <SettingsFieldRow class="mt-5" label="Current password" for="delete-password">
          <div class="flex flex-col gap-2">
            <input
              id="delete-password"
              v-model="deletePassword"
              type="password"
              data-testid="delete-password-input"
              class="w-full min-w-0 rounded-lg border border-readion-background-surface bg-readion-background-overlay px-3 py-2 text-readion-text-primary text-sm"
            />

            <p
              v-if="deleteError"
              data-testid="delete-account-error"
              class="break-words text-readion-status-poor text-sm"
              role="alert"
            >
              {{ deleteError }}
            </p>
          </div>
        </SettingsFieldRow>

        <div class="mt-6 flex flex-wrap justify-end gap-3">
          <ReadionButton
            variant="secondary"
            :disabled="deletingAccount"
            @click="closeDeleteModal"
          >
            Cancel
          </ReadionButton>
          <ReadionButton
            data-testid="confirm-delete-btn"
            variant="destructive"
            :disabled="!canConfirmDelete"
            :busy="deletingAccount"
            busy-label="Deleting…"
            @click="confirmDeleteAccount"
          >
            Delete account
          </ReadionButton>
        </div>
      </div>
    </div>
  </div>
</template>
