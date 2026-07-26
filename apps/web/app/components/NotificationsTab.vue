<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { ref, watch } from 'vue'
import { ReadionProblemDetailsError } from '~/api/mutator'
import { settingsQueryKeys } from '~/composables/settingsQueryKeys'
import { useSettingsProfile } from '~/composables/useSettingsProfile'
import { usersControllerUpdateMe } from '~~/src/api/users/users'

const queryClient = useQueryClient()
const profileQuery = useSettingsProfile()

const digestEnabled = ref(false)
const saving = ref(false)
const errorMessage = ref<string | null>(null)
const saved = ref(false)

watch(
  () => profileQuery.data.value?.digestOptOut,
  (optedOut) => {
    if (optedOut !== undefined) {
      digestEnabled.value = !optedOut
    }
  },
  { immediate: true },
)

async function toggleDigest() {
  if (saving.value) {
    return
  }
  errorMessage.value = null
  saved.value = false
  const nextEnabled = !digestEnabled.value

  saving.value = true
  try {
    await usersControllerUpdateMe({ digestOptOut: !nextEnabled })
    digestEnabled.value = nextEnabled
    await queryClient.invalidateQueries({ queryKey: settingsQueryKeys.profile() })
    saved.value = true
  } catch (error) {
    errorMessage.value =
      error instanceof ReadionProblemDetailsError
        ? (error.detail ?? error.title)
        : 'Could not update your notification preferences. Please try again.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex w-full min-w-0 flex-col gap-8">
    <section class="flex min-w-0 flex-col gap-3">
      <h2 class="font-medium text-slate-100 text-sm">Email notifications</h2>

      <div
        class="flex min-w-0 flex-col gap-3 rounded-xl border border-readion-background-surface bg-readion-background-elevated p-4 sm:p-5"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <h3 class="font-medium text-slate-100 text-sm">Weekly progress digest</h3>
            <p class="break-words text-readion-text-secondary text-sm">
              A weekly email summarising your study progress and what to focus on next.
            </p>
          </div>

          <button
            type="button"
            role="switch"
            data-testid="digest-toggle"
            :aria-checked="digestEnabled"
            :aria-busy="saving ? 'true' : undefined"
            aria-label="Weekly progress digest"
            :disabled="saving"
            class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60"
            :class="digestEnabled ? 'bg-readion-primary' : 'bg-readion-background-surface'"
            @click="toggleDigest"
          >
            <span
              class="inline-block size-5 transform rounded-full bg-white transition-transform"
              :class="digestEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'"
            />
            <span v-if="saving" class="sr-only" role="status">Saving…</span>
          </button>
        </div>

        <p
          v-if="errorMessage"
          data-testid="digest-error"
          class="break-words text-readion-status-poor text-sm"
          role="alert"
        >
          {{ errorMessage }}
        </p>

        <p
          v-if="saved"
          data-testid="digest-confirmation"
          class="text-readion-status-good text-sm"
          role="status"
        >
          Notification preference saved.
        </p>

        <p class="text-slate-500 text-xs">
          You can also opt out using the one-click unsubscribe link at the foot of any digest email.
        </p>
      </div>
    </section>
  </div>
</template>
