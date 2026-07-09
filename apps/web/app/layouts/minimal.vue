<template>
  <div class="flex h-screen flex-col bg-readion-background-base text-slate-100 antialiased">
    <header
      class="flex h-13 flex-shrink-0 items-center border-readion-border-strong border-b bg-readion-background-elevated px-8"
    >
      <NuxtLink to="/" class="flex items-center gap-2">
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
