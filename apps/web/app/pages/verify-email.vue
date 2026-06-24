<template>
  <div class="text-center">
    <!-- Success state -->
    <template v-if="state === 'success'">
      <div class="w-13 h-13 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-5">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      </div>
      <h1 class="text-xl font-bold text-slate-100 mb-2">Email verified</h1>
      <p class="text-sm text-slate-500 mb-6">Your account is activated. You're all set!</p>
      <NuxtLink
        to="/"
        class="inline-block px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-md transition-colors"
      >
        Continue to app
      </NuxtLink>
    </template>

    <!-- Error state -->
    <template v-else-if="state === 'error'">
      <div class="w-13 h-13 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center mx-auto mb-5">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      </div>
      <h1 class="text-xl font-bold text-slate-100 mb-2">Link invalid or expired</h1>
      <p class="text-sm text-slate-500 mb-6">
        This verification link is invalid or expired. Links expire after 24 hours.
      </p>
      <button
        v-if="isAuthenticated"
        data-testid="resend-btn"
        :disabled="resendLoading"
        class="text-sm text-indigo-400 hover:text-indigo-300"
        @click="handleResend"
      >
        {{ resendLoading ? 'Sending…' : 'Resend verification email' }}
      </button>
      <p v-if="resendSent" class="mt-2 text-sm text-emerald-400">Verification email sent!</p>
    </template>

    <!-- Loading state -->
    <template v-else>
      <div class="w-13 h-13 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-5">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7c8cf8" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      </div>
      <h1 class="text-xl font-bold text-slate-100 mb-2">Verifying your email…</h1>
      <p class="text-sm text-slate-500">Just a moment.</p>
    </template>

  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getCsrfTokenFromCookie } from '~/api/mutator'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'auth' })

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const isAuthenticated = computed(() => auth.isAuthenticated)

type State = 'loading' | 'success' | 'error'

const state = ref<State>('loading')
const resendLoading = ref(false)
const resendSent = ref(false)

const token = route.query?.token as string | undefined

const runtimeConfig = useRuntimeConfig()
const apiBase = computed(() => (runtimeConfig.public.apiBaseUrl as string).replace(/\/$/, ''))

onMounted(async () => {
  if (!token) {
    state.value = 'error'
    return
  }

  try {
    const csrfToken = getCsrfTokenFromCookie()
    const res = await fetch(`${apiBase.value}/auth/verify-email`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
      },
      body: JSON.stringify({ token }),
    })

    if (res.ok) {
      state.value = 'success'
      router.push('/')
    } else {
      state.value = 'error'
    }
  } catch {
    state.value = 'error'
  }
})

async function handleResend() {
  resendLoading.value = true
  try {
    const csrfToken = getCsrfTokenFromCookie()
    const res = await fetch(`${apiBase.value}/auth/resend-verification`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
        ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
      },
    })
    if (res.ok) {
      resendSent.value = true
    }
  } catch {
    // Silently fail — user can try again
  } finally {
    resendLoading.value = false
  }
}
</script>
