import { runAuthBootstrap } from '~/composables/useAuthBootstrap'
import { useAuthStore } from '~/stores/auth'

export default defineNuxtPlugin(() => {
  if (import.meta.server) return

  const auth = useAuthStore()
  return runAuthBootstrap(auth)
})
