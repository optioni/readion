<script setup lang="ts">
import { computed, ref } from 'vue'
import CertHeaderBar from '~/components/CertHeaderBar.vue'
import ExamHistoryTab from '~/components/ExamHistoryTab.vue'
import OverviewTab from '~/components/OverviewTab.vue'
import SessionsTab from '~/components/SessionsTab.vue'
import { progressPath } from '~/composables/runnerRoutes'
import { useCertDetail } from '~/composables/useCertDetail'
import { useQuickStartActions } from '~/composables/useQuickStartActions'

type TabId = 'overview' | 'sessions' | 'exam-history'

const route = useRoute()
const enrollmentId = computed(() => String(route.params.id))

const { name, provider, code, certificationId, domains, isLoading, isError, notFound } =
  useCertDetail(enrollmentId.value)

const { startSession, startMockExam, isStartingSession, isStartingMockExam } = useQuickStartActions(
  enrollmentId.value,
)

const tabs: { id: TabId; label: string; panelTestId: string }[] = [
  { id: 'overview', label: 'Overview', panelTestId: 'cert-detail-tab-overview' },
  { id: 'sessions', label: 'Sessions', panelTestId: 'cert-detail-tab-sessions' },
  { id: 'exam-history', label: 'Exam history', panelTestId: 'cert-detail-tab-exam-history' },
]

const activeTab = ref<TabId>('overview')
function selectTab(id: TabId) {
  activeTab.value = id
}
</script>

<template>
  <section data-testid="cert-detail-page" class="w-full">
    <div
      v-if="notFound"
      data-testid="cert-detail-not-found"
      class="flex flex-col items-center gap-3 rounded-xl border border-readion-background-surface border-dashed px-6 py-16 text-center"
    >
      <p class="font-medium text-lg text-slate-200">Certification not found</p>
      <p class="max-w-sm text-slate-400 text-sm">
        This enrollment does not exist or is not available to you.
      </p>
    </div>

    <template v-else>
      <div
        v-if="isLoading"
        data-testid="cert-detail-loading"
        class="-mx-4 -mt-8 space-y-2 border-readion-background-surface border-b px-4 py-4 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10"
      >
        <div class="h-7 w-64 animate-pulse rounded bg-readion-background-surface" />
        <div class="h-4 w-32 animate-pulse rounded bg-readion-background-surface" />
      </div>
      <CertHeaderBar
        v-else
        :name="name"
        :provider="provider"
        :code="code"
        :is-starting-session="isStartingSession"
        :is-starting-mock-exam="isStartingMockExam"
        @start-session="startSession"
        @start-mock-exam="startMockExam"
      />

      <p
        v-if="isError"
        data-testid="cert-detail-error"
        class="mt-3 rounded-lg border border-readion-status-warning/30 bg-readion-status-warning/10 px-4 py-3 text-readion-status-warning text-sm"
      >
        Some details could not be loaded. Showing what we have.
      </p>

      <div class="mt-3 flex justify-end">
        <NuxtLink
          data-testid="view-progress-link"
          :to="progressPath(enrollmentId)"
          class="inline-flex items-center text-readion-primary text-xs hover:underline"
        >
          View progress
        </NuxtLink>
      </div>

      <div
        role="tablist"
        class="mb-6 flex gap-6 border-readion-background-surface border-b"
      >
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          role="tab"
          :aria-selected="activeTab === tab.id"
          class="-mb-px border-b-2 px-1 py-3 font-medium text-sm transition-colors"
          :class="
            activeTab === tab.id
              ? 'border-readion-primary text-readion-primary'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          "
          @click="selectTab(tab.id)"
        >
          {{ tab.label }}
        </button>
      </div>

      <div
        v-for="tab in tabs"
        :key="tab.id"
        v-show="activeTab === tab.id"
        role="tabpanel"
        :data-testid="tab.panelTestId"
      >
        <OverviewTab
          v-if="tab.id === 'overview'"
          :enrollment-id="enrollmentId"
          :certification-id="certificationId"
          :domains="domains"
        />
        <SessionsTab v-if="tab.id === 'sessions'" :certification-id="certificationId" />
        <ExamHistoryTab v-if="tab.id === 'exam-history'" :enrollment-id="enrollmentId" />
      </div>
    </template>
  </section>
</template>
