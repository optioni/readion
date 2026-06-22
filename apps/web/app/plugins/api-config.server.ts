import { resolvePublicApiBaseUrl } from '~/config/api-base-url'

export default defineNuxtPlugin(() => {
  resolvePublicApiBaseUrl(process.env)
})
