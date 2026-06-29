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
  const nextEnabled = !digestEnabled.value
  digestEnabled.value = nextEnabled

  saving.value = true
  try {
    await usersControllerUpdateMe({ digestOptOut: !nextEnabled })
    await queryClient.invalidateQueries({ queryKey: settingsQueryKeys.profile() })
  } catch (error) {
    digestEnabled.value = !nextEnabled
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
  <div class="flex flex-col gap-8">
    <section class="flex flex-col gap-3">
      <h2 class="font-medium text-slate-100 text-sm">Email notifications</h2>

      <div
        class="flex flex-col gap-3 rounded-xl border border-readion-background-surface bg-readion-background-elevated p-5"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex flex-col gap-1">
            <h3 class="font-medium text-slate-100 text-sm">Weekly progress digest</h3>
            <p class="text-slate-400 text-sm">
              A weekly email summarising your study progress and what to focus on next.
            </p>
          </div>

          <button
            type="button"
            role="switch"
            data-testid="digest-toggle"
            :aria-checked="digestEnabled"
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
          </button>
        </div>

        <p v-if="errorMessage" data-testid="digest-error" class="text-red-400 text-sm">
          {{ errorMessage }}
        </p>

        <p class="text-slate-500 text-xs">
          You can also opt out using the one-click unsubscribe link at the foot of any digest email.
        </p>
      </div>
    </section>
  </div>
</template>
