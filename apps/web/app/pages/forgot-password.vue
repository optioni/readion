<template>
  <div>
    <NuxtLink to="/login" class="text-xs text-indigo-400 hover:text-indigo-300 block mb-7">
      ← Back to sign in
    </NuxtLink>

    <template v-if="sent">
      <div class="text-center">
        <div class="w-13 h-13 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>
        <h1 class="text-xl font-bold text-slate-100 mb-2">Check your email</h1>
        <p class="text-sm text-slate-500 mb-6 leading-relaxed">
          if an account exists for <span class="text-slate-300 font-medium">{{ submittedEmail }}</span>,
          a reset link has been sent. It expires in 1 hour.
        </p>
        <div class="text-xs text-slate-600 bg-readion-background-elevated border border-slate-700 rounded-lg p-3">
          Didn't receive it? Check your spam folder or wait a minute before trying again.
        </div>
      </div>
    </template>

    <template v-else>
      <h1 class="text-xl font-bold text-slate-100 mb-1">Reset your password</h1>
      <p class="text-sm text-slate-500 mb-7 leading-relaxed">
        Enter your account email and we'll send a reset link. It expires in 1 hour.
      </p>

      <form @submit.prevent="handleSubmit">
        <div class="mb-5">
          <label class="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
          <input
            v-model="email"
            type="email"
            placeholder="you@example.com"
            autocomplete="email"
            required
            class="w-full px-3 py-2 bg-readion-background-base border border-slate-700 rounded-md text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <button
          type="submit"
          :disabled="loading"
          class="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-md transition-colors disabled:opacity-60"
        >
          <span v-if="loading">Sending…</span>
          <span v-else>Send reset link</span>
        </button>
      </form>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

definePageMeta({ layout: 'auth' })

const email = ref('')
const loading = ref(false)
const sent = ref(false)
const submittedEmail = ref('')

const runtimeConfig = useRuntimeConfig()
const apiBase = (runtimeConfig.public.apiBaseUrl as string).replace(/\/$/, '')

async function handleSubmit() {
  loading.value = true
  submittedEmail.value = email.value

  try {
    await fetch(`${apiBase}/auth/forgot-password`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value }),
    })
  } catch {
    // Intentionally ignore errors — always show neutral confirmation
  } finally {
    sent.value = true
    loading.value = false
  }
}
</script>
