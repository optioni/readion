<template>
  <div class="min-h-screen flex bg-readion-background-base text-slate-100 antialiased">
    <!-- Brand panel -->
    <aside
      class="hidden lg:flex w-70 flex-shrink-0 flex-col justify-between bg-readion-background-elevated border-r border-slate-700 px-8 py-10"
    >
      <!-- Logo -->
      <div>
        <div class="flex items-center gap-2.5 mb-12">
          <div
            class="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center flex-shrink-0"
          >
            <svg width="15" height="15" viewBox="0 0 12 12" fill="none">
              <path
                d="M6 1l1.5 3.5L11 5l-2.5 2.5.5 3.5L6 9.5 3 11l.5-3.5L1 5l3.5-.5z"
                fill="#0f172a"
              />
            </svg>
          </div>
          <span class="text-base font-bold tracking-tight text-slate-100">Readion</span>
        </div>

        <!-- Tagline -->
        <div class="mb-10">
          <h1 class="text-2xl font-bold text-slate-100 leading-snug mb-2.5">
            Exam-ready,<br />faster.
          </h1>
          <p class="text-sm text-slate-500 leading-relaxed">
            Adaptive study sessions, spaced-repetition review, and AI explanations — all grounded
            in your actual weak areas.
          </p>
        </div>

        <!-- Features -->
        <ul class="flex flex-col gap-3">
          <li
            v-for="feature in features"
            :key="feature"
            class="flex items-start gap-2.5 text-xs text-readion-text-secondary"
          >
            <span
              data-testid="feature-badge"
              class="mt-px flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border border-readion-status-good bg-readion-status-good/[0.12]"
            >
              <svg class="h-2 w-2 text-readion-status-good" viewBox="0 0 9 9" fill="none">
                <path
                  d="M2 4.5l2 2 3-3"
                  stroke="currentColor"
                  stroke-width="1.4"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
            <span class="leading-[1.55]">{{ feature }}</span>
          </li>
        </ul>
      </div>

      <!-- Testimonial -->
      <blockquote
        class="mt-10 rounded-lg border border-readion-border-strong bg-readion-background-overlay px-3.5 py-3"
      >
        <p class="mb-2 text-xs text-readion-text-secondary italic leading-[1.6]">
          "Passed SAA-C03 on the first attempt. The weak area targeting is genuinely different."
        </p>
        <cite class="text-[11px] text-readion-text-muted not-italic">— Alex K., AWS Solutions Architect</cite>
      </blockquote>
    </aside>

    <!-- Form panel -->
    <main class="flex flex-1 flex-col justify-center bg-readion-background-surface px-9 py-10">
      <div class="w-full max-w-sm">
        <slot />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const features = [
  'Readiness score that actually predicts pass/fail',
  'AI agent during sessions — no context limits',
  'Diagnostic that maps your gaps from day one',
]
</script>
