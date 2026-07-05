<script setup lang="ts">
// Layout reconciled against openspec/design/Onboarding.html (V3 sidebar wizard)
import type { SessionDefaults } from '@readion/shared'
import { computed, ref, watch } from 'vue'
import OnboardingCertSelect from '~/components/OnboardingCertSelect.vue'
import OnboardingDiagnosticOffer from '~/components/OnboardingDiagnosticOffer.vue'
import OnboardingSessionPrefs from '~/components/OnboardingSessionPrefs.vue'
import { ADMIN_CERT_SETUP_ROUTE } from '~/composables/onboardingRoutes'
import { useOnboardingActions } from '~/composables/useOnboardingActions'
import { useOnboardingGate } from '~/composables/useOnboardingGate'
import { useTrack } from '~/composables/useTrack'

definePageMeta({ layout: 'minimal' })

const { decision, isLoading } = useOnboardingGate()
const { saveDefaultsAndEnroll } = useOnboardingActions()
const { track } = useTrack()

type Step = 'cert' | 'prefs' | 'offer'

const step = ref<Step>('cert')
const certificationId = ref<string | null>(null)
const enrollmentId = ref<string | null>(null)
const enrollError = ref<string | null>(null)
// Enrolling refetches the gate's enrollments query, flipping the decision to `dashboard` mid-flow.
// Once the user has started enrolling we own the navigation (offer step → skip/take), so the
// defensive redirect must not fire — otherwise it yanks the user off the diagnostic offer.
const hasStartedEnrollment = ref(false)

// Keep the wizard mounted through the offer step even after enrolling flips the gate to `dashboard`.
const isOnboarding = computed(
  () => decision.value?.kind === 'onboarding' || hasStartedEnrollment.value,
)
const isNoCerts = computed(() => decision.value?.kind === 'no-certs')

const onboardingStartTracked = ref(false)
watch(
  isOnboarding,
  (active) => {
    if (active && !onboardingStartTracked.value) {
      onboardingStartTracked.value = true
      track('onboarding_started')
    }
  },
  { immediate: true },
)

watch(
  decision,
  (value) => {
    if (!value) return
    if (value.kind === 'admin-cert-setup') {
      navigateTo(ADMIN_CERT_SETUP_ROUTE)
      return
    }
    if (value.kind === 'dashboard' && !hasStartedEnrollment.value) navigateTo('/')
  },
  { immediate: true },
)

const steps = [
  { id: 'cert' as const, label: 'Certification' },
  { id: 'prefs' as const, label: 'Preferences' },
  { id: 'offer' as const, label: 'Diagnostic' },
]

const activeIndex = computed(() => steps.findIndex((s) => s.id === step.value))

const chrome = {
  cert: {
    eyebrow: 'Step 1 of 3',
    heading: 'Choose your target certification',
    sub: 'You can add more certifications later from your profile.',
  },
  prefs: {
    eyebrow: 'Step 2 of 3',
    heading: 'Study preferences',
    sub: 'Readion adapts over time — these are your starting defaults.',
  },
  offer: {
    eyebrow: 'Step 3 of 3',
    heading: 'Calibrate your first session',
    sub: 'An optional diagnostic personalizes your study plan from day one.',
  },
} satisfies Record<Step, { eyebrow: string; heading: string; sub: string }>

function onCertContinue(id: string) {
  certificationId.value = id
  enrollError.value = null
  step.value = 'prefs'
}

async function onPrefsConfirm(sessionDefaults: SessionDefaults) {
  if (!certificationId.value) return
  enrollError.value = null
  hasStartedEnrollment.value = true
  const outcome = await saveDefaultsAndEnroll({
    certificationId: certificationId.value,
    sessionDefaults,
  })
  if (outcome.ok) {
    enrollmentId.value = outcome.enrollmentId
    step.value = 'offer'
    return
  }
  hasStartedEnrollment.value = false
  enrollError.value = 'We could not complete your enrollment. Please try again.'
}
</script>

<template>
  <div
    v-if="isNoCerts"
    class="flex min-h-[60vh] items-center justify-center px-6 py-12"
  >
    <div
      class="flex max-w-md flex-col items-center gap-4 rounded-xl border border-slate-700 bg-readion-background-surface px-8 py-12 text-center"
    >
      <span
        class="flex h-12 w-12 items-center justify-center rounded-full bg-readion-background-elevated text-2xl text-indigo-400"
      >★</span>
      <h1 class="font-semibold text-lg text-slate-200">
        No certifications available yet
      </h1>
      <p class="text-slate-400 text-sm leading-relaxed">
        There are no certifications to enroll in right now.
      </p>
      <p
        class="w-full rounded-lg bg-readion-background-base px-4 py-3 text-slate-500 text-xs leading-relaxed"
      >
        Certifications are added by your account admin. You will be able to start studying as soon
        as one becomes available.
      </p>
    </div>
  </div>

  <div
    v-else-if="isOnboarding"
    data-testid="onboarding-page"
    class="flex min-h-[80vh] overflow-hidden rounded-xl border border-slate-700 bg-readion-background-base"
  >
    <aside
      class="hidden w-52 flex-shrink-0 flex-col justify-between border-slate-700 border-r bg-readion-background-elevated px-5 py-8 lg:flex"
    >
      <div class="flex flex-col gap-8">
        <div class="flex flex-col gap-1">
          <span
            class="font-semibold text-indigo-400 text-xs uppercase tracking-[0.2em]"
          >
            Readion
          </span>
          <span class="text-slate-600 text-xs">Setup</span>
        </div>

        <ol class="flex flex-col gap-4">
          <li
            v-for="(s, index) in steps"
            :key="s.id"
            class="flex items-center gap-3"
          >
            <span
              class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px]"
              :class="
                index < activeIndex
                  ? 'bg-readion-primary/20 text-readion-primary'
                  : index === activeIndex
                    ? 'bg-readion-primary text-white'
                    : 'border border-slate-700 text-slate-600'
              "
            >
              <span v-if="index < activeIndex">✓</span>
              <span v-else>{{ index + 1 }}</span>
            </span>
            <span
              class="text-sm"
              :class="index === activeIndex ? 'text-slate-200' : 'text-slate-400'"
            >
              {{ s.label }}
            </span>
          </li>
        </ol>
      </div>

      <p class="text-slate-600 text-xs">Setup takes about 2 minutes.</p>
    </aside>

    <section class="flex-1 px-6 py-10 sm:px-12">
      <div class="mx-auto flex max-w-[520px] flex-col gap-6">
        <header class="flex flex-col gap-2">
          <span
            class="font-semibold text-indigo-400 text-xs uppercase tracking-[0.2em]"
          >
            {{ chrome[step].eyebrow }}
          </span>
          <h1 class="font-semibold text-[22px] text-slate-200 leading-tight">
            {{ chrome[step].heading }}
          </h1>
          <p class="text-[13px] text-slate-500">{{ chrome[step].sub }}</p>
        </header>

        <p
          v-if="enrollError"
          data-testid="onboarding-enroll-error"
          class="rounded-lg border border-readion-status-warning/30 bg-readion-status-warning/10 px-4 py-3 text-readion-status-warning text-sm"
        >
          {{ enrollError }}
        </p>

        <OnboardingCertSelect v-if="step === 'cert'" @continue="onCertContinue" />
        <OnboardingSessionPrefs v-else-if="step === 'prefs'" @confirm="onPrefsConfirm" />
        <OnboardingDiagnosticOffer
          v-else-if="step === 'offer' && enrollmentId"
          :enrollment-id="enrollmentId"
        />
      </div>
    </section>
  </div>

  <div
    v-else-if="isLoading"
    data-testid="onboarding-loading"
    class="flex min-h-[80vh] items-center justify-center"
  >
    <div class="h-40 w-full max-w-3xl animate-pulse rounded-xl bg-readion-background-surface" />
  </div>
</template>
