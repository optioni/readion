<template>
  <div>
    <h1 class="text-xl font-bold text-slate-100 mb-1">Sign in</h1>
    <p class="text-sm text-slate-500 mb-7">
      Don't have an account?
      <NuxtLink to="/register" class="text-indigo-400 hover:text-indigo-300">Create one</NuxtLink>
    </p>

    <div
      v-if="resetSuccess"
      class="flex items-center gap-2.5 px-3 py-2.5 mb-4 rounded-lg bg-emerald-500/8 border border-emerald-500/25 text-sm text-emerald-400"
    >
      Password updated — sign in with your new password.
    </div>

    <div
      v-if="loginError"
      data-testid="login-error"
      class="flex items-center gap-2.5 px-3 py-2.5 mb-4 rounded-lg bg-red-500/8 border border-red-500/25 text-sm text-red-400"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.2" />
        <path d="M8 5v4M8 11h.01" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
      </svg>
      {{ loginError }}
    </div>

    <form @submit.prevent="handleSubmit">
      <div class="mb-4">
        <label
          for="login-email"
          class="block text-xs font-medium text-slate-400 mb-1.5"
          >Email</label
        >
        <input
          id="login-email"
          v-model="email"
          type="email"
          placeholder="you@example.com"
          autocomplete="email"
          required
          class="w-full px-3 py-2 bg-readion-background-base border border-slate-700 rounded-md text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div class="mb-2">
        <label
          for="login-password"
          class="block text-xs font-medium text-slate-400 mb-1.5"
          >Password</label
        >
        <div class="relative">
          <input
            id="login-password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="••••••••"
            autocomplete="current-password"
            required
            class="w-full px-3 py-2 pr-10 bg-readion-background-base border border-slate-700 rounded-md text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="button"
            class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            :aria-label="showPassword ? 'Hide password' : 'Show password'"
            @click="showPassword = !showPassword"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      </div>

      <div class="flex justify-end mb-5">
        <NuxtLink to="/forgot-password" class="text-xs text-indigo-400 hover:text-indigo-300">
          Forgot password?
        </NuxtLink>
      </div>

      <button
        type="submit"
        :disabled="loading"
        class="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-md transition-colors disabled:opacity-60"
      >
        <span v-if="loading">Signing in…</span>
        <span v-else>Sign in</span>
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { createReadionFetch, ReadionProblemDetailsError } from '~/api/mutator'
import { useTrack } from '~/composables/useTrack'
import type { AuthUser } from '~/stores/auth'
import { useAuthStore } from '~/stores/auth'
import { buildPageSeoMeta } from '~/utils/seo'

definePageMeta({ layout: 'auth' })

useSeoMeta(
  buildPageSeoMeta({
    title: 'Sign in',
    description: 'Sign in to your Readion account to continue your certification exam prep.',
  }),
)

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const { track } = useTrack()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const loginError = ref<string | null>(null)
const resetSuccess = computed(() => route.query?.reset === 'success')

type LoginResponse = { data: { data: { accessToken: string } }; status: number; headers: Headers }
type MeResponse = { data: { data: AuthUser }; status: number; headers: Headers }

async function handleSubmit() {
  loginError.value = null
  loading.value = true

  const runtimeConfig = useRuntimeConfig()
  const readionFetch = createReadionFetch({ apiBaseUrl: runtimeConfig.public.apiBaseUrl })

  try {
    const loginRes = await readionFetch<LoginResponse>('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value, password: password.value }),
    })
    const accessToken = loginRes.data?.data?.accessToken
    if (!accessToken) throw new Error('Missing access token')
    auth.setSession(accessToken, null)

    const meRes = await readionFetch<MeResponse>('/api/v1/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (meRes.data?.data) {
      auth.setUser(meRes.data.data)
    }

    track('log_in')

    const redirect = (route.query?.redirect as string) || '/'
    router.push(redirect)
  } catch (err) {
    if (err instanceof ReadionProblemDetailsError && err.status === 401) {
      loginError.value = 'Incorrect email or password.'
    } else {
      loginError.value = 'Something went wrong. Please try again.'
    }
  } finally {
    loading.value = false
  }
}
</script>
