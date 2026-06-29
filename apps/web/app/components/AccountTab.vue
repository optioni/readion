<script setup lang="ts">
import { changePasswordRequestSchema, updateUserProfileRequestSchema } from '@readion/shared'
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import { ReadionProblemDetailsError } from '~/api/mutator'
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

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const changingPassword = ref(false)
const passwordChanged = ref(false)
const currentPasswordError = ref<string | null>(null)
const newPasswordError = ref<string | null>(null)
const confirmPasswordError = ref<string | null>(null)

async function changePassword() {
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
  deleteModalOpen.value = false
}

async function confirmDeleteAccount() {
  if (!canConfirmDelete.value) {
    return
  }
  deleteError.value = null

  deletingAccount.value = true
  try {
    await usersControllerDeleteMe({
      headers: jsonHeaders,
      body: JSON.stringify({ password: deletePassword.value }),
    })
    authStore.clear()
    await navigateTo('/login')
  } catch (error) {
    deleteError.value =
      error instanceof ReadionProblemDetailsError && error.status === 401
        ? 'Invalid password. Please try again.'
        : error instanceof ReadionProblemDetailsError
          ? (error.detail ?? error.title)
          : 'Could not delete your account. Please try again.'
  } finally {
    deletingAccount.value = false
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

      <div class="flex flex-col gap-2">
        <label
          for="current-password"
          class="font-mono text-slate-400 text-xs uppercase tracking-wide"
        >
          Current password
        </label>
        <input
          id="current-password"
          v-model="currentPassword"
          type="password"
          data-testid="current-password-input"
          class="rounded-lg border border-readion-background-surface bg-readion-background-elevated px-3 py-2 text-slate-100 text-sm"
        />
        <p
          v-if="currentPasswordError"
          data-testid="current-password-error"
          class="text-red-400 text-sm"
        >
          {{ currentPasswordError }}
        </p>
      </div>

      <div class="flex flex-col gap-2">
        <label
          for="new-password"
          class="font-mono text-slate-400 text-xs uppercase tracking-wide"
        >
          New password
        </label>
        <input
          id="new-password"
          v-model="newPassword"
          type="password"
          data-testid="new-password-input"
          class="rounded-lg border border-readion-background-surface bg-readion-background-elevated px-3 py-2 text-slate-100 text-sm"
        />
        <p v-if="newPasswordError" data-testid="new-password-error" class="text-red-400 text-sm">
          {{ newPasswordError }}
        </p>
      </div>

      <div class="flex flex-col gap-2">
        <label
          for="confirm-password"
          class="font-mono text-slate-400 text-xs uppercase tracking-wide"
        >
          Confirm new password
        </label>
        <input
          id="confirm-password"
          v-model="confirmPassword"
          type="password"
          data-testid="confirm-password-input"
          class="rounded-lg border border-readion-background-surface bg-readion-background-elevated px-3 py-2 text-slate-100 text-sm"
        />
        <p
          v-if="confirmPasswordError"
          data-testid="confirm-password-error"
          class="text-red-400 text-sm"
        >
          {{ confirmPasswordError }}
        </p>
      </div>

      <p
        v-if="passwordChanged"
        data-testid="change-password-confirmation"
        class="text-emerald-400 text-sm"
      >
        Your password has been changed.
      </p>

      <button
        type="button"
        data-testid="change-password-btn"
        :disabled="changingPassword"
        class="self-start rounded-lg bg-readion-primary px-5 py-2.5 font-medium text-sm text-white transition-colors hover:bg-readion-primary/90 disabled:opacity-60"
        @click="changePassword"
      >
        Change password
      </button>
    </section>

    <section class="flex flex-col gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-5">
      <h2 class="font-medium text-red-300 text-sm">Danger zone</h2>
      <p class="text-slate-400 text-sm">
        Deleting your account is permanent. Your sessions, progress, and certifications are removed.
      </p>

      <button
        type="button"
        data-testid="delete-account-btn"
        class="self-start rounded-lg border border-red-500/50 bg-red-500/10 px-5 py-2.5 font-medium text-red-200 text-sm transition-colors hover:bg-red-500/20"
        @click="openDeleteModal"
      >
        Delete account
      </button>
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
        class="relative z-10 w-full max-w-md rounded-xl border border-readion-background-surface bg-readion-background-elevated p-6 shadow-xl"
      >
        <h2 class="font-semibold text-slate-100 text-lg">Delete account</h2>
        <p class="mt-1 text-slate-400 text-sm">
          This action is permanent. Enter your current password to confirm.
        </p>

        <div class="mt-5 flex flex-col gap-2">
          <label
            for="delete-password"
            class="font-mono text-slate-400 text-xs uppercase tracking-wide"
          >
            Current password
          </label>
          <input
            id="delete-password"
            v-model="deletePassword"
            type="password"
            data-testid="delete-password-input"
            class="rounded-lg border border-readion-background-surface bg-readion-background-overlay px-3 py-2 text-slate-100 text-sm"
          />

          <p v-if="deleteError" data-testid="delete-account-error" class="text-red-400 text-sm">
            {{ deleteError }}
          </p>
        </div>

        <div class="mt-6 flex justify-end gap-3">
          <button
            type="button"
            class="rounded-lg border border-readion-background-surface px-5 py-2.5 font-medium text-slate-100 text-sm transition-colors hover:bg-readion-background-surface"
            @click="closeDeleteModal"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="confirm-delete-btn"
            :disabled="!canConfirmDelete"
            class="rounded-lg bg-red-500 px-5 py-2.5 font-medium text-sm text-white transition-colors hover:bg-red-500/90 disabled:opacity-60"
            @click="confirmDeleteAccount"
          >
            Delete account
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
