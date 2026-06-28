<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { onboardingQueryKeys } from '~/composables/onboardingQueryKeys'
import { certificationsControllerList } from '~~/src/api/certifications/certifications'

const emit = defineEmits<{ continue: [certificationId: string] }>()

const certificationsQuery = useQuery({
  queryKey: onboardingQueryKeys.certifications(),
  queryFn: async () => {
    const response = await certificationsControllerList()
    return response.data.data
  },
})

const options = computed(() => certificationsQuery.data.value ?? [])

const selectedId = ref<string | null>(null)

function select(certificationId: string) {
  selectedId.value = certificationId
}

function confirm() {
  if (!selectedId.value) {
    return
  }
  emit('continue', selectedId.value)
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <ul class="flex flex-col gap-2">
      <li v-for="option in options" :key="option.id">
        <button
          type="button"
          data-testid="cert-option"
          :data-cert-id="option.id"
          :aria-pressed="selectedId === option.id"
          class="flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors"
          :class="
            selectedId === option.id
              ? 'border-readion-primary bg-readion-primary/10'
              : 'border-readion-background-surface hover:border-readion-primary'
          "
          @click="select(option.id)"
        >
          <span
            class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border"
            :class="
              selectedId === option.id
                ? 'border-readion-primary'
                : 'border-readion-background-surface'
            "
          >
            <span
              v-if="selectedId === option.id"
              class="h-2 w-2 rounded-full bg-readion-primary"
            />
          </span>
          <span class="flex flex-1 flex-col">
            <span
              class="font-medium text-sm"
              :class="selectedId === option.id ? 'text-slate-100' : 'text-slate-200'"
            >
              {{ option.name }}
            </span>
            <span class="text-slate-400 text-xs uppercase tracking-wide">{{ option.provider }}</span>
          </span>
          <span
            class="rounded-md bg-readion-background-elevated px-2 py-1 font-mono text-slate-400 text-xs"
          >
            {{ option.code }}
          </span>
        </button>
      </li>
    </ul>

    <button
      type="button"
      class="self-end rounded-lg bg-readion-primary px-5 py-2.5 font-medium text-sm text-white transition-colors hover:bg-readion-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="selectedId === null"
      @click="confirm"
    >
      Continue
    </button>
  </div>
</template>
