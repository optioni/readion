import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type AuthUser = {
  id: string
  email: string
  emailVerified: boolean
  displayTimezone: string
  createdAt: string
}

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(null)
  const user = ref<AuthUser | null>(null)

  let resolveReady!: () => void
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve
    if (import.meta.server) resolve()
  })

  const isAuthenticated = computed(() => accessToken.value !== null)

  function setSession(token: string, authUser: AuthUser | null) {
    accessToken.value = token
    user.value = authUser
  }

  function setUser(authUser: AuthUser) {
    user.value = authUser
  }

  function clear() {
    accessToken.value = null
    user.value = null
  }

  function markReady() {
    resolveReady()
  }

  return { accessToken, user, isAuthenticated, ready, setSession, setUser, clear, markReady }
})
