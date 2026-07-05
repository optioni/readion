import { injectUmamiScript, watchIdentify } from '~/composables/umamiBootstrap'
import { useTrack } from '~/composables/useTrack'
import { useAuthStore } from '~/stores/auth'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  injectUmamiScript(document, {
    host: String(config.public.umamiHost ?? ''),
    websiteId: String(config.public.umamiWebsiteId ?? ''),
  })

  const auth = useAuthStore()
  const { identify } = useTrack()
  watchIdentify(() => auth.user?.id, identify)
})
