<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import ReadionAsyncRegion from '~/components/ReadionAsyncRegion.vue'
import ReadionButton from '~/components/ReadionButton.vue'
import { dashboardQueryKeys } from '~/composables/dashboardQueryKeys'
import { certificationsControllerList } from '~~/src/api/certifications/certifications'
import {
  userCertificationsControllerEnroll,
  userCertificationsControllerList,
} from '~~/src/api/user-certifications/user-certifications'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [boolean] }>()

const queryClient = useQueryClient()
const enabled = computed(() => props.open)

const certificationsQuery = useQuery({
  queryKey: dashboardQueryKeys.certifications(),
  queryFn: async () => {
    const response = await certificationsControllerList()
    return response.data.data
  },
  enabled,
})

const enrollmentsQuery = useQuery({
  queryKey: dashboardQueryKeys.enrollments(),
  queryFn: async () => {
    const response = await userCertificationsControllerList({ status: 'active' })
    return response.data.data
  },
  enabled,
})

const options = computed(() => {
  const certifications = certificationsQuery.data.value ?? []
  const enrolledIds = new Set(
    (enrollmentsQuery.data.value ?? []).map((enrollment) => enrollment.certificationId),
  )
  return certifications.filter((certification) => !enrolledIds.has(certification.id))
})

const listsReady = computed(
  () => certificationsQuery.data.value !== undefined && enrollmentsQuery.data.value !== undefined,
)
const listsFailed = computed(
  () => certificationsQuery.isError.value || enrollmentsQuery.isError.value,
)
const listsUnresolved = computed(
  () =>
    (certificationsQuery.data.value === undefined && !certificationsQuery.isError.value) ||
    (enrollmentsQuery.data.value === undefined && !enrollmentsQuery.isError.value),
)
const initialListsLoading = computed(() => !listsReady.value && listsUnresolved.value)
const initialListsError = computed(() =>
  !listsReady.value && !listsUnresolved.value && listsFailed.value
    ? 'Couldn’t load available certifications.'
    : undefined,
)
const refreshingLists = computed(
  () =>
    listsReady.value && (certificationsQuery.isFetching.value || enrollmentsQuery.isFetching.value),
)
const refreshListsError = computed(() =>
  listsReady.value && listsFailed.value ? 'Couldn’t refresh available certifications.' : undefined,
)

const enrollingId = ref<string | null>(null)
const selectedId = ref<string | null>(null)
const enrollError = ref<string | null>(null)
const retryingLists = ref(false)

async function retryLists() {
  if (retryingLists.value) return
  retryingLists.value = true
  try {
    const retries: Promise<unknown>[] = []
    if (certificationsQuery.isError.value) {
      retries.push(certificationsQuery.refetch())
    }
    if (enrollmentsQuery.isError.value) {
      retries.push(enrollmentsQuery.refetch())
    }
    await Promise.all(retries)
  } finally {
    retryingLists.value = false
  }
}

async function selectCertification(certificationId: string) {
  if (enrollingId.value) {
    return
  }
  selectedId.value = certificationId
  enrollError.value = null
  enrollingId.value = certificationId
  try {
    await userCertificationsControllerEnroll({
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ certificationId }),
    })
    await queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.enrollments() })
    close()
  } catch {
    const selected = options.value.find((option) => option.id === certificationId)
    enrollError.value = `Couldn't add ${selected?.name ?? 'this certification'}. Try again.`
  } finally {
    enrollingId.value = null
  }
}

function close() {
  emit('update:open', false)
}
</script>

<template>
  <div
    v-if="open"
    data-testid="add-cert-modal"
    role="dialog"
    aria-modal="true"
    aria-label="Add a certification"
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
  >
    <button
      type="button"
      data-testid="add-cert-close"
      aria-label="Close"
      class="absolute inset-0 bg-black/60"
      @click="close"
    />

    <div
      class="relative z-10 w-full max-w-md rounded-xl border border-readion-background-surface bg-readion-background-elevated p-6 shadow-xl"
    >
      <div class="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 class="font-semibold text-slate-100 text-lg">Add a certification</h2>
          <p class="mt-1 text-slate-400 text-sm">
            Pick a certification to start a personalized study plan.
          </p>
        </div>
        <button
          type="button"
          class="rounded-md p-1 text-slate-400 transition-colors hover:text-slate-200"
          aria-label="Close dialog"
          @click="close"
        >
          ✕
        </button>
      </div>

      <ReadionAsyncRegion
        :loading="initialListsLoading"
        :error="initialListsError"
        :empty="listsReady && options.length === 0"
        :refreshing="refreshingLists"
        :retrying="retryingLists"
        loading-label="Loading available certifications…"
        refresh-label="Refreshing available certifications…"
        retrying-label="Retrying…"
        aria-label="Available certifications"
        @retry="retryLists"
      >
        <template #loading>
          <div
            data-testid="add-cert-loading"
            class="flex flex-col gap-2"
            aria-hidden="true"
          >
            <div
              v-for="index in 3"
              :key="index"
              class="h-10 animate-pulse rounded-lg bg-readion-background-surface motion-reduce:animate-none"
            />
          </div>
        </template>
        <template #error>
          <span data-testid="add-cert-list-error">{{ initialListsError }}</span>
        </template>
        <template #empty>
          <p
            data-testid="add-cert-empty-options"
            class="rounded-lg border border-readion-background-surface border-dashed px-4 py-8 text-center text-slate-400 text-sm"
          >
            You are enrolled in every available certification.
          </p>
        </template>

        <div
          v-if="refreshListsError"
          data-testid="add-cert-list-refresh-error"
          class="mb-3 flex items-center justify-between gap-3 rounded-lg border border-readion-status-poor/30 bg-readion-status-poor/10 px-3 py-2 text-readion-status-poor text-xs"
          role="alert"
        >
          <span>{{ refreshListsError }}</span>
          <ReadionButton
            variant="secondary"
            :busy="retryingLists"
            busy-label="Retrying…"
            @click="retryLists"
          >
            Retry
          </ReadionButton>
        </div>

        <ul class="flex flex-col gap-2">
          <li v-for="option in options" :key="option.id">
            <ReadionButton
              data-testid="add-cert-option"
              :data-cert-id="option.id"
              :data-selected="selectedId === option.id ? 'true' : undefined"
              variant="secondary"
              :busy="enrollingId === option.id"
              :busy-label="`Adding… ${option.name}`"
              :disabled="enrollingId !== null && enrollingId !== option.id"
              class="w-full justify-between text-left"
              :class="{ 'border-readion-status-poor': selectedId === option.id && enrollError }"
              @click="selectCertification(option.id)"
            >
              <span class="font-medium">{{ option.name }}</span>
              <span class="text-readion-text-secondary text-xs uppercase tracking-wide">
                {{ option.provider }}
              </span>
            </ReadionButton>
            <p
              v-if="selectedId === option.id && enrollError"
              class="mt-2 text-readion-status-poor text-xs"
              role="alert"
            >
              {{ enrollError }}
            </p>
          </li>
        </ul>
      </ReadionAsyncRegion>
    </div>
  </div>
</template>
