import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import { useFoundationStore } from '~/stores/foundation'

describe('foundation Pinia store', () => {
  it('is usable from a mounted component with reactive initial state', () => {
    const Probe = defineComponent({
      setup() {
        return { foundation: useFoundationStore() }
      },
      template: '<span>{{ foundation.appName }}</span>',
    })

    const wrapper = mount(Probe, {
      global: {
        plugins: [createPinia()],
      },
    })

    expect(wrapper.text()).toBe('Readion')
  })
})
