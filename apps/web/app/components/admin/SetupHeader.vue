<script setup lang="ts">
import { computed } from 'vue'
import {
  CERT_SETUP_STEP_COUNT,
  type CertSetupStep,
  certSetupStepLabel,
  certSetupStepProgress,
} from '~/composables/certSetupSteps'

const props = defineProps<{ step: CertSetupStep; code?: string; certName?: string }>()
const emit = defineEmits<{ cancel: [] }>()

const stepIndicator = computed(
  () => `Step ${props.step} of ${CERT_SETUP_STEP_COUNT} · ${certSetupStepLabel(props.step)}`,
)
const progressWidth = computed(() => `${certSetupStepProgress(props.step)}%`)
const headerTitle = computed(() => props.certName || 'New certification')
</script>

<template>
  <div data-testid="setup-header" class="flex flex-col gap-2">
    <div class="flex items-end justify-between gap-4">
      <div>
        <nav data-testid="setup-header-breadcrumb" class="text-slate-400 text-xs">
          Certifications › New<template v-if="code"> › {{ code }}</template>
        </nav>
        <h1 data-testid="setup-header-title" class="mt-0.5 font-semibold text-base text-white">
          {{ headerTitle }}
        </h1>
      </div>
      <div class="flex shrink-0 items-center gap-4">
        <span data-testid="setup-header-step-indicator" class="font-medium text-slate-100 text-sm">
          {{ stepIndicator }}
        </span>
        <button
          type="button"
          data-testid="setup-header-cancel"
          class="font-medium text-slate-400 text-xs transition-colors hover:text-slate-100"
          @click="emit('cancel')"
        >
          Cancel
        </button>
      </div>
    </div>
    <div class="h-1.5 w-full overflow-hidden rounded-full bg-readion-background-surface">
      <div
        data-testid="setup-header-progress"
        role="progressbar"
        aria-valuemin="0"
        :aria-valuemax="CERT_SETUP_STEP_COUNT"
        :aria-valuenow="step"
        class="h-full rounded-full bg-readion-primary transition-all"
        :style="{ width: progressWidth }"
      />
    </div>
  </div>
</template>
