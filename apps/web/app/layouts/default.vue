<template>
  <div class="min-h-screen bg-readion-background-base text-slate-100 antialiased">
    <AppNavBar />

    <main data-testid="shell-container" class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <slot />
    </main>
  </div>
</template>
