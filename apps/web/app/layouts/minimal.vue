<template>
  <div class="flex h-screen flex-col bg-readion-background-base text-slate-100 antialiased">
    <header
      class="flex h-13 flex-shrink-0 items-center border-readion-border-strong border-b bg-readion-background-elevated px-8"
    >
      <NuxtLink to="/" class="flex items-center gap-2">
        <span
          data-testid="brand-mark"
          class="flex h-5.5 w-5.5 flex-shrink-0 items-center justify-center rounded-md bg-readion-accent-label"
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path
              d="M6 1l1.5 3.5L11 5l-2.5 2.5.5 3.5L6 9.5 3 11l.5-3.5L1 5l3.5-.5z"
              fill="#0f172a"
            />
          </svg>
        </span>
        <span class="font-semibold text-sm text-white">Readion</span>
      </NuxtLink>
      <div class="flex-1" />
      <NuxtLink to="/" class="text-readion-text-muted text-xs hover:text-slate-200">
        &#8592; Back to dashboard
      </NuxtLink>
    </header>

    <main class="flex min-h-0 flex-1 flex-col">
      <slot />
    </main>
  </div>
</template>
