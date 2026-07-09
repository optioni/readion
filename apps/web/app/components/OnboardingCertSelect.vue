<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import type { CertificationResponseDto } from '~~/src/api/model'
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

const query = ref('')

const filteredOptions = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (!needle) {
    return options.value
  }
  return options.value.filter((option) =>
    [option.name, option.provider, option.code].some((field) =>
      field.toLowerCase().includes(needle),
    ),
  )
})

type CertGroup = { provider: string; options: CertificationResponseDto[] }

// Groups are keyed by each cert's own `provider` (no curated vendor buckets) and ordered by
// first appearance in the catalog, so the layout stays deterministic across re-renders.
const groupedOptions = computed<CertGroup[]>(() => {
  const groups: CertGroup[] = []
  const groupIndexByProvider = new Map<string, number>()
  for (const option of filteredOptions.value) {
    const existingIndex = groupIndexByProvider.get(option.provider)
    if (existingIndex === undefined) {
      groupIndexByProvider.set(option.provider, groups.length)
      groups.push({ provider: option.provider, options: [option] })
    } else {
      groups[existingIndex]?.options.push(option)
    }
  }
  return groups
})

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
    <div
      class="flex items-center gap-2 rounded-lg border border-readion-background-surface bg-readion-background-base px-3 py-2 focus-within:border-readion-primary"
    >
      <svg
        data-testid="cert-search-icon"
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
        class="shrink-0 text-slate-500"
      >
        <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5" />
        <path d="M11 11l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
      <input
        v-model="query"
        data-testid="cert-search-input"
        type="search"
        placeholder="Search certifications…"
        class="w-full flex-1 bg-transparent text-slate-200 text-sm placeholder:text-slate-500 focus:outline-none"
      />
      <span
        data-testid="cert-search-count"
        class="shrink-0 rounded bg-readion-background-elevated px-1.5 py-0.5 text-slate-500 text-xs"
      >
        {{ options.length }} available
      </span>
    </div>

    <div class="flex flex-col gap-1">
      <div v-for="group in groupedOptions" :key="group.provider" data-testid="cert-group">
        <div
          data-testid="cert-group-header"
          class="px-2.5 py-1 font-medium text-[11px] text-slate-500 uppercase tracking-wide"
        >
          {{ group.provider }}
        </div>
        <ul class="flex flex-col gap-1">
          <li v-for="option in group.options" :key="option.id">
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
              <span
                class="flex-1 font-medium text-sm"
                :class="selectedId === option.id ? 'text-slate-100' : 'text-slate-200'"
              >
                {{ option.name }}
              </span>
              <span
                class="rounded-md bg-readion-background-elevated px-2 py-1 font-mono text-slate-400 text-xs"
              >
                {{ option.code }}
              </span>
            </button>
          </li>
        </ul>
      </div>
    </div>

    <div
      data-testid="cert-select-footer"
      class="flex justify-end border-t border-readion-background-surface pt-5"
    >
      <button
        type="button"
        class="rounded-lg bg-readion-primary px-5 py-2.5 font-medium text-sm text-white transition-colors hover:bg-readion-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="selectedId === null"
        @click="confirm"
      >
        Continue →
      </button>
    </div>
  </div>
</template>
