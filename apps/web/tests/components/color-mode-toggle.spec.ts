import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import ColorModeToggle from '~/components/ColorModeToggle.vue'

describe('ColorModeToggle', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.className = ''
  })

  it('toggles the persisted color mode and accessible label', async () => {
    const wrapper = mount(ColorModeToggle)

    expect(wrapper.get('button').attributes('aria-label')).toBe('Switch to light mode')
    expect(wrapper.text()).toBe('Dark')

    await wrapper.get('button').trigger('click')

    expect(wrapper.get('button').attributes('aria-label')).toBe('Switch to dark mode')
    expect(wrapper.text()).toBe('Light')
    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(window.localStorage.getItem('readion-color-mode')).toBe('light')
  })
})
