<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, nextTick, ref, watch } from 'vue'
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
const dialogPanel = ref<HTMLElement | null>(null)
const modalOpener = ref<HTMLElement | null>(null)

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

function restoreModalFocus() {
  void nextTick(() => modalOpener.value?.focus())
}

function close() {
  emit('update:open', false)
  restoreModalFocus()
}

function handleDialogKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (event.key !== 'Tab' || !dialogPanel.value) return

  const focusable = Array.from(
    dialogPanel.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  )
  const first = focusable[0]
  const last = focusable.at(-1)
  if (!first || !last) return

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(
  () => props.open,
  (open, wasOpen) => {
    if (open) {
      const active = document.activeElement
      if (active instanceof HTMLElement && !dialogPanel.value?.contains(active)) {
        modalOpener.value = active
      }
      void nextTick(() =>
        dialogPanel.value
          ?.querySelector<HTMLElement>('[data-testid="add-cert-close-dialog"]')
          ?.focus(),
      )
    } else if (wasOpen) {
      restoreModalFocus()
    }
  },
  { immediate: true },
)
</script>

<template>
  <div
    v-if="open"
    data-testid="add-cert-modal"
    role="dialog"
    aria-modal="true"
    aria-label="Add a certification"
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    @keydown="handleDialogKeydown"
  >
    <button
      type="button"
      data-testid="add-cert-close"
      aria-label="Close"
      class="absolute inset-0 bg-black/60"
      @click="close"
    />

    <div
      ref="dialogPanel"
      class="relative z-10 w-full max-w-md rounded-xl border border-readion-border-strong bg-readion-background-elevated p-6 shadow-xl"
    >
      <div class="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2
            data-testid="add-cert-title"
            class="font-semibold text-readion-text-primary text-lg"
          >
            Add a certification
          </h2>
          <p data-testid="add-cert-intro" class="mt-1 text-readion-text-secondary text-sm">
            Pick a certification to start a personalized study plan.
          </p>
        </div>
        <ReadionButton
          data-testid="add-cert-close-dialog"
          variant="icon"
          aria-label="Close dialog"
          class="shrink-0"
          @click="close"
        >
          ✕
        </ReadionButton>
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
            class="rounded-lg border border-readion-border-strong border-dashed px-4 py-8 text-center text-readion-text-secondary text-sm"
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
