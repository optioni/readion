import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import type { App } from 'vue'

export const readionQueryDefaultOptions = {
  queries: {
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: 30_000,
  },
} as const

export const readionQueryClient = new QueryClient({
  defaultOptions: readionQueryDefaultOptions,
})

export const readionVueQueryPlugin = {
  install(app: App) {
    app.use(VueQueryPlugin, {
      queryClient: readionQueryClient,
    })
  },
}
