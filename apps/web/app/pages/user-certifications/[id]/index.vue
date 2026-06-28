<script setup lang="ts">
import { computed, ref } from 'vue'
import ExamHistoryTab from '~/components/ExamHistoryTab.vue'
import OverviewTab from '~/components/OverviewTab.vue'
import SessionsTab from '~/components/SessionsTab.vue'
import { useCertDetail } from '~/composables/useCertDetail'

type TabId = 'overview' | 'sessions' | 'exam-history'

const route = useRoute()
const enrollmentId = computed(() => String(route.params.id))

const { name, provider, certificationId, domains, isLoading, isError, notFound } = useCertDetail(
  enrollmentId.value,
)

const tabs: { id: TabId; label: string; panelTestId: string }[] = [
  { id: 'overview', label: 'Overview', panelTestId: 'cert-detail-tab-overview' },
  { id: 'sessions', label: 'Sessions', panelTestId: 'cert-detail-tab-sessions' },
  { id: 'exam-history', label: 'Exam History', panelTestId: 'cert-detail-tab-exam-history' },
]

const activeTab = ref<TabId>('overview')
function selectTab(id: TabId) {
  activeTab.value = id
}
</script>

<template>
  <section data-testid="cert-detail-page" class="mx-auto max-w-[720px]">
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
      <header class="mb-6">
        <p class="mb-1 font-medium text-[11px] text-slate-400 uppercase tracking-wider">
          Certification
        </p>
        <div v-if="isLoading" data-testid="cert-detail-loading" class="space-y-2">
          <div class="h-7 w-64 animate-pulse rounded bg-readion-background-surface" />
          <div class="h-4 w-32 animate-pulse rounded bg-readion-background-surface" />
        </div>
        <template v-else>
          <h1 data-testid="cert-detail-name" class="font-semibold text-2xl text-slate-100">
            {{ name }}
          </h1>
          <p data-testid="cert-detail-provider" class="text-slate-400 text-sm">{{ provider }}</p>
        </template>
        <p
          v-if="isError"
          data-testid="cert-detail-error"
          class="mt-3 rounded-lg border border-readion-status-warning/30 bg-readion-status-warning/10 px-4 py-3 text-readion-status-warning text-sm"
        >
          Some details could not be loaded. Showing what we have.
        </p>
      </header>

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
