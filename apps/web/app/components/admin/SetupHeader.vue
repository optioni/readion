<script setup lang="ts">
import { computed } from 'vue'
import {
  CERT_SETUP_STEP_COUNT,
  type CertSetupStep,
  certSetupStepLabel,
  certSetupStepProgress,
} from '~/composables/certSetupSteps'

const props = defineProps<{ step: CertSetupStep }>()
const emit = defineEmits<{ cancel: [] }>()

const stepIndicator = computed(
  () => `Step ${props.step} of ${CERT_SETUP_STEP_COUNT} · ${certSetupStepLabel(props.step)}`,
)
const progressWidth = computed(() => `${certSetupStepProgress(props.step)}%`)
</script>

<template>
  <div data-testid="setup-header" class="flex flex-col gap-2">
    <nav data-testid="setup-header-breadcrumb" class="text-slate-400 text-xs">
      Admin › Certifications › New
    </nav>
    <div class="flex items-center justify-between">
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
