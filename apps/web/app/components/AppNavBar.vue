<template>
  <header class="border-slate-800 border-b bg-readion-background-overlay">
    <nav class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
      <NuxtLink to="/" class="min-w-0 font-semibold text-lg text-white">Readion</NuxtLink>
      <div class="flex items-center gap-3">
        <ColorModeToggle />
        <button
          v-if="auth.isAuthenticated"
          data-testid="logout-btn"
          type="button"
          class="text-sm text-slate-400 hover:text-slate-200 transition-colors"
          @click="handleLogout"
        >
          Log out
        </button>
      </div>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { getCsrfTokenFromCookie } from '~/api/mutator'
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const runtimeConfig = useRuntimeConfig()
const apiBase = (runtimeConfig.public.apiBaseUrl as string).replace(/\/$/, '')

async function handleLogout() {
  try {
    const csrfToken = getCsrfTokenFromCookie()
    await fetch(`${apiBase}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      ...(csrfToken ? { headers: { 'x-csrf-token': csrfToken } } : {}),
    })
  } catch {
    // Best-effort — always clear local state
  } finally {
    auth.clear()
    router.push('/login')
  }
}
</script>
