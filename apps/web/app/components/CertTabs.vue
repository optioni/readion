<script setup lang="ts">
import { ref } from 'vue'
import AddCertificationModal from '~/components/AddCertificationModal.vue'

export interface SwitcherEntry {
  enrollmentId: string
  certName: string
}

const props = defineProps<{
  enrollments: SwitcherEntry[]
  activeEnrollmentId: string
}>()

const addModalOpen = ref(false)

function switchTo(enrollmentId: string) {
  if (enrollmentId === props.activeEnrollmentId) {
    return
  }
  navigateTo(`/user-certifications/${enrollmentId}/progress`)
}
</script>

<template>
  <div data-testid="cert-switcher" class="flex flex-wrap items-center gap-2">
    <button
      v-for="entry in enrollments"
      :key="entry.enrollmentId"
      type="button"
      :aria-current="entry.enrollmentId === activeEnrollmentId ? 'page' : undefined"
      class="rounded-lg border px-3 py-1.5 text-sm transition-colors"
      :class="
        entry.enrollmentId === activeEnrollmentId
          ? 'border-readion-primary bg-readion-primary/10 text-readion-primary'
          : 'border-readion-background-surface text-slate-400 hover:text-slate-200'
      "
      @click="switchTo(entry.enrollmentId)"
    >
      {{ entry.certName }}
    </button>

    <button
      type="button"
      data-testid="cert-switcher-add"
      class="rounded-lg border border-dashed border-readion-background-surface px-3 py-1.5 text-slate-500 text-sm transition-colors hover:border-readion-primary hover:text-readion-primary"
      @click="addModalOpen = true"
    >
      + Add
    </button>

    <AddCertificationModal v-model:open="addModalOpen" />
  </div>
</template>
