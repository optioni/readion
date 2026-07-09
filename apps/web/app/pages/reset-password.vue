<template>
  <div>
    <!-- Loading -->
    <template v-if="tokenState === 'loading'">
      <p class="text-sm text-slate-500">Validating reset link…</p>
    </template>

    <!-- Invalid token -->
    <template v-else-if="tokenState === 'invalid'">
      <div class="text-center">
        <div class="w-13 h-13 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center mx-auto mb-5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        </div>
        <h1 class="text-xl font-bold text-slate-100 mb-2">Link invalid or expired</h1>
        <p class="text-sm text-slate-500 mb-6">
          This reset link is invalid or expired. Links expire after 1 hour.
        </p>
        <NuxtLink to="/forgot-password" class="text-sm text-indigo-400 hover:text-indigo-300">
          Request a new link
        </NuxtLink>
      </div>
    </template>

    <!-- Valid token — new password form -->
    <template v-else>
      <template v-if="success">
        <div class="text-center">
          <div class="w-13 h-13 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h1 class="text-xl font-bold text-slate-100 mb-2">Password updated</h1>
          <p class="text-sm text-slate-500 mb-6">Your password has been set. Sign in to continue.</p>
          <NuxtLink to="/login" class="inline-block px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-md transition-colors">
            Sign in
          </NuxtLink>
        </div>
      </template>

      <template v-else>
        <h1 class="text-xl font-bold text-slate-100 mb-1">Choose a new password</h1>
        <p class="text-sm text-slate-500 mb-7">Make it something you haven't used before.</p>

        <form @submit.prevent="handleSubmit">
          <div class="mb-1.5">
            <label class="block text-xs font-medium text-slate-400 mb-1.5">New password</label>
            <div class="relative">
              <input
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
          <div v-if="password.length > 0" class="mb-5">
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
          <div v-else class="mb-5" />

          <div class="mb-5">
            <label class="block text-xs font-medium text-slate-400 mb-1.5">Confirm password</label>
            <div class="relative">
              <input
                data-testid="confirm-password-input"
                v-model="confirmPassword"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Re-enter your password"
                autocomplete="new-password"
                required
                :class="[
                  'w-full px-3 py-2 pr-10 bg-readion-background-base border rounded-md text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500',
                  confirmBorderClass,
                ]"
              />
              <div
                v-if="passwordsMatch"
                data-testid="confirm-password-success"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-readion-status-good"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" fill="rgba(52,211,153,0.12)" stroke="currentColor" stroke-width="1.2" />
                  <path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </div>
            </div>
            <p v-if="passwordsMismatch" data-testid="confirm-password-mismatch" class="mt-1.5 text-xs text-readion-status-poor">
              Passwords do not match
            </p>
          </div>

          <button
            type="submit"
            :disabled="loading || !canSubmit"
            class="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-md transition-colors disabled:opacity-60"
          >
            <span v-if="loading">Setting password…</span>
            <span v-else>Set new password</span>
          </button>
        </form>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useCredentialForm } from '~/composables/useCredentialForm'
import { useTrack } from '~/composables/useTrack'
import { credentialFieldBorderClass } from '~/utils/credentialFieldStyles'

definePageMeta({ layout: 'auth' })

const route = useRoute()
const router = useRouter()
const { track } = useTrack()

const { password, showPassword, loading, passwordStrength, strengthLabel, strengthColor } =
  useCredentialForm()
const token = route.query?.token as string | undefined

const confirmPassword = ref('')
const passwordsMatch = computed(
  () => confirmPassword.value.length > 0 && confirmPassword.value === password.value,
)
const passwordsMismatch = computed(
  () => confirmPassword.value.length > 0 && confirmPassword.value !== password.value,
)
const canSubmit = computed(() => password.value.length >= 8 && passwordsMatch.value)
const confirmBorderClass = computed(() => credentialFieldBorderClass(passwordsMismatch.value))

type TokenState = 'loading' | 'valid' | 'invalid'
const tokenState = ref<TokenState>('loading')
const success = ref(false)

const runtimeConfig = useRuntimeConfig()
const apiBase = (runtimeConfig.public.apiBaseUrl as string).replace(/\/$/, '')

onMounted(async () => {
  if (!token) {
    tokenState.value = 'invalid'
    return
  }

  try {
    const res = await fetch(`${apiBase}/auth/reset-password?token=${encodeURIComponent(token)}`, {
      credentials: 'include',
    })
    tokenState.value = res.ok ? 'valid' : 'invalid'
  } catch {
    tokenState.value = 'invalid'
  }
})

async function handleSubmit() {
  if (!canSubmit.value) return

  loading.value = true
  try {
    const res = await fetch(`${apiBase}/auth/reset-password`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password: password.value }),
    })

    if (res.ok) {
      track('password_reset_completed')
      router.push({ path: '/login', query: { reset: 'success' } })
    }
  } catch {
    // Silently handle — user can try again
  } finally {
    loading.value = false
  }
}
</script>
