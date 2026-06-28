import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

export function renderComposable<TResult>(composable: () => TResult) {
  const captured = { value: undefined as TResult | undefined }
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })

  const wrapper = mount(
    defineComponent({
      setup() {
        captured.value = composable()
        return () => h('div')
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
  )

  if (captured.value === undefined) {
    throw new Error('composable did not return a value')
  }

  return { result: captured.value, wrapper, queryClient }
}
