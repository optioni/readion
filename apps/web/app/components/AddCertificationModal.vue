<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
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

const enrollingId = ref<string | null>(null)

async function selectCertification(certificationId: string) {
  if (enrollingId.value) {
    return
  }
  enrollingId.value = certificationId
  try {
    await userCertificationsControllerEnroll({
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ certificationId }),
    })
    await queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.enrollments() })
    close()
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

      <p
        v-if="options.length === 0"
        data-testid="add-cert-empty-options"
        class="rounded-lg border border-readion-background-surface border-dashed px-4 py-8 text-center text-slate-400 text-sm"
      >
        You are enrolled in every available certification.
      </p>

      <ul v-else class="flex flex-col gap-2">
        <li v-for="option in options" :key="option.id">
          <button
            type="button"
            data-testid="add-cert-option"
            :data-cert-id="option.id"
            :disabled="enrollingId !== null"
            class="flex w-full items-center justify-between gap-3 rounded-lg border border-readion-background-surface px-4 py-3 text-left transition-colors hover:border-readion-primary disabled:opacity-60"
            @click="selectCertification(option.id)"
          >
            <span class="font-medium text-slate-100 text-sm">{{ option.name }}</span>
            <span class="text-slate-400 text-xs uppercase tracking-wide">{{ option.provider }}</span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
