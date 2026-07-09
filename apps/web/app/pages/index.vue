<script setup lang="ts">
import { computed, ref } from 'vue'
import AddCertificationModal from '~/components/AddCertificationModal.vue'
import CertCard from '~/components/CertCard.vue'
import DiagnosticRePromptNudge from '~/components/DiagnosticRePromptNudge.vue'
import PageHeader from '~/components/PageHeader.vue'
import { selectHeroAndOrder } from '~/composables/dashboardOrdering'
import { useEnrollments } from '~/composables/useEnrollments'

const { cards, isLoading, isError } = useEnrollments()

const ordering = computed(() => selectHeroAndOrder(cards.value))
const hasEnrollments = computed(() => cards.value.length > 0)

const isAddCertOpen = ref(false)
function openAddCert() {
  isAddCertOpen.value = true
}
</script>

<template>
  <section class="mx-auto max-w-[1100px]">
    <PageHeader eyebrow="DASHBOARD" title="Your certifications" :active-count="cards.length" />

    <div
      v-if="isLoading"
      data-testid="dashboard-loading"
      class="flex flex-col gap-3.5"
    >
      <div
        v-for="n in 2"
        :key="n"
        class="h-40 animate-pulse rounded-xl bg-readion-background-surface"
      />
    </div>

    <template v-else>
      <p
        v-if="isError"
        data-testid="dashboard-error"
        class="mb-4 rounded-lg border border-readion-status-warning/30 bg-readion-status-warning/10 px-4 py-3 text-readion-status-warning text-sm"
      >
        Some of your certifications could not be loaded. Showing what we have.
      </p>

      <div
        v-if="hasEnrollments"
        data-testid="dashboard-list"
        class="flex flex-col gap-3.5"
      >
        <DiagnosticRePromptNudge
          v-for="card in cards"
          :key="`nudge-${card.enrollmentId}`"
          :enrollment-id="card.enrollmentId"
        />
        <div v-if="ordering.hero" data-testid="cert-card-hero">
          <CertCard :card="ordering.hero" variant="hero" />
        </div>
        <CertCard
          v-for="card in ordering.rest"
          :key="card.enrollmentId"
          :card="card"
          variant="standard"
        />
        <button
          data-testid="add-cert"
          type="button"
          :aria-expanded="isAddCertOpen"
          class="flex items-center gap-3 rounded-xl border border-readion-background-surface border-dashed px-5 py-4 text-left text-slate-400 transition-colors hover:border-readion-primary hover:text-slate-200"
          @click="openAddCert"
        >
          <span
            class="flex h-8 w-8 items-center justify-center rounded-md bg-readion-background-surface text-lg leading-none"
          >+</span>
          <span>
            <span class="block font-medium text-sm">Add certification</span>
            <span class="mt-0.5 block text-[11px] text-slate-500"
              >Track another exam alongside this one</span
            >
          </span>
        </button>
      </div>

      <div
        v-else-if="!isError"
        data-testid="dashboard-empty"
        class="flex flex-col items-center gap-4 rounded-xl border border-readion-background-surface border-dashed px-6 py-16 text-center"
      >
        <p class="font-medium text-lg text-slate-200">No certifications yet</p>
        <p class="max-w-sm text-slate-400 text-sm">
          Add a certification to start building your personalized study plan.
        </p>
        <button
          data-testid="add-cert-empty"
          type="button"
          :aria-expanded="isAddCertOpen"
          class="rounded-md bg-readion-primary px-5 py-2.5 font-medium text-sm text-white transition-colors hover:bg-readion-primary-hover"
          @click="openAddCert"
        >
          + Add certification
        </button>
      </div>
    </template>

    <AddCertificationModal v-model:open="isAddCertOpen" />
  </section>
</template>
