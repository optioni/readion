import { useQueryClient } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import {
  readionQueryClient,
  readionQueryDefaultOptions,
  readionVueQueryPlugin,
} from '~/lib/vue-query'
import {
  getHealthControllerCheckQueryKey,
  useHealthControllerCheck,
} from '../../src/api/health/health'

describe('Vue Query plugin', () => {
  it('provides one shared QueryClient to generated composables', () => {
    const Probe = defineComponent({
      setup() {
        const query = useHealthControllerCheck({
          query: {
            queryKey: getHealthControllerCheckQueryKey(),
            enabled: false,
          },
        })
        const queryClient = useQueryClient()

        return {
          queryKey: query.queryKey,
          sameClient: queryClient === readionQueryClient,
        }
      },
      template: '<span>{{ sameClient }}:{{ queryKey.join("/") }}</span>',
    })

    const first = mount(Probe, {
      global: {
        plugins: [readionVueQueryPlugin],
      },
    })
    const second = mount(Probe, {
      global: {
        plugins: [readionVueQueryPlugin],
      },
    })

    expect(first.text()).toBe('true:health')
    expect(second.text()).toBe('true:health')
  })

  it('centralizes default query behavior', () => {
    expect(readionQueryDefaultOptions.queries).toEqual({
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
    })
  })
})
