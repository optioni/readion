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
            class="flex items-start gap-2.5 text-sm text-slate-400"
          >
            <svg
              class="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path
                d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"
              />
            </svg>
            {{ feature }}
          </li>
        </ul>
      </div>

      <!-- Testimonial -->
      <blockquote class="mt-10 border-t border-slate-700 pt-6">
        <p class="text-sm text-slate-400 italic leading-relaxed mb-3">
          "Readion's diagnostic found gaps I didn't know I had. Passed AWS SAA on the first
          attempt."
        </p>
        <cite class="text-xs text-slate-500 not-italic">— Santiago R., AWS Solutions Architect</cite>
      </blockquote>
    </aside>

    <!-- Form panel -->
    <main class="flex flex-1 items-center justify-center px-6 py-12 bg-readion-background-surface">
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
  'Covers AWS, Azure, Kubernetes, and AI/ML certs',
]
</script>
