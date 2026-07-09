<template>
  <div>
    <h1 class="text-xl font-bold text-slate-100 mb-1">Create your account</h1>
    <p class="text-sm text-slate-500 mb-7">
      Already have an account?
      <NuxtLink to="/login" class="text-indigo-400 hover:text-indigo-300">Sign in</NuxtLink>
    </p>

    <div
      v-if="globalError"
      data-testid="register-error"
      class="flex items-center gap-2.5 px-3 py-2.5 mb-4 rounded-lg bg-red-500/8 border border-red-500/25 text-sm text-red-400"
    >
      {{ globalError }}
    </div>

    <form @submit.prevent="handleSubmit">
      <div class="mb-4">
        <label
          for="register-email"
          class="block text-xs font-medium text-slate-400 mb-1.5"
          >Email</label
        >
        <input
          id="register-email"
          v-model="email"
          type="email"
          placeholder="you@example.com"
          autocomplete="email"
          required
          class="w-full px-3 py-2 bg-readion-background-base border border-slate-700 rounded-md text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div class="mb-1.5">
        <label
          for="register-password"
          class="block text-xs font-medium text-slate-400 mb-1.5"
          >Password</label
        >
        <div class="relative">
          <input
            id="register-password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="At least 8 characters"
            autocomplete="new-password"
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

      <!-- Password strength meter -->
      <div v-if="password.length > 0" class="mb-4">
        <div class="flex gap-1 mt-1.5">
          <div
            v-for="i in 4"
            :key="i"
            class="flex-1 h-0.5 rounded-sm transition-colors"
            :style="{ background: i <= passwordStrength ? strengthColor : '#334155' }"
          />
          <span class="text-xs ml-1 whitespace-nowrap" :style="{ color: strengthColor }">{{ strengthLabel }}</span>
        </div>
      </div>
      <div v-else class="mb-4" />

      <p v-if="fieldError('password')" class="mb-3 text-xs text-red-400">{{ fieldError('password') }}</p>

      <button
        type="submit"
        :disabled="loading"
        class="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-md transition-colors disabled:opacity-60"
      >
        <span v-if="loading">Creating account…</span>
        <span v-else>Create account</span>
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { createReadionFetch, ReadionProblemDetailsError } from '~/api/mutator'
import { registerErrorMessage } from '~/composables/registerErrorMessage'
import { useCredentialForm } from '~/composables/useCredentialForm'
import { useTrack } from '~/composables/useTrack'
import type { AuthUser } from '~/stores/auth'
import { useAuthStore } from '~/stores/auth'
import { buildPageSeoMeta } from '~/utils/seo'

definePageMeta({ layout: 'auth' })

useSeoMeta(
  buildPageSeoMeta({
    title: 'Create your account',
    description: 'Create a Readion account to start personalized certification exam prep.',
  }),
)

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const { track } = useTrack()

const {
  email,
  password,
  showPassword,
  loading,
  passwordStrength,
  strengthLabel,
  strengthColor,
  fieldError,
  parseFieldErrors,
  clearErrors,
} = useCredentialForm()
const globalError = ref<string | null>(null)

type RegisterResponse = {
  data: { data: { accessToken: string } }
  status: number
  headers: Headers
}
type MeResponse = { data: { data: AuthUser }; status: number; headers: Headers }

async function handleSubmit() {
  clearErrors()
  globalError.value = null

  if (password.value.length < 8) {
    return
  }

  loading.value = true
  const runtimeConfig = useRuntimeConfig()
  const readionFetch = createReadionFetch({ apiBaseUrl: runtimeConfig.public.apiBaseUrl })

  try {
    const registerRes = await readionFetch<RegisterResponse>('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value, password: password.value }),
    })
    const accessToken = registerRes.data?.data?.accessToken
    if (!accessToken) throw new Error('Missing access token')
    auth.setSession(accessToken, null)

    const meRes = await readionFetch<MeResponse>('/api/v1/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (meRes.data?.data) {
      auth.setUser(meRes.data.data)
    }

    track('sign_up')

    const redirect = (route.query?.redirect as string) || '/'
    router.push(redirect)
  } catch (err) {
    if (err instanceof ReadionProblemDetailsError && err.status === 422) {
      parseFieldErrors(err)
    } else {
      globalError.value = registerErrorMessage(err)
    }
  } finally {
    loading.value = false
  }
}
</script>
