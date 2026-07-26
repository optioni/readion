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

    const toggle = wrapper.get('[data-testid="color-mode-toggle"]')
    expect(toggle.attributes('aria-label')).toBe('Switch to light mode')
    expect(toggle.attributes('data-variant')).toBe('secondary')
    expect(toggle.classes()).toContain('focus-visible:ring-readion-focus')
    expect(wrapper.text()).toBe('Dark')

    await toggle.trigger('click')

    expect(toggle.attributes('aria-label')).toBe('Switch to dark mode')
    expect(wrapper.text()).toBe('Light')
    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(window.localStorage.getItem('readion-color-mode')).toBe('light')
  })
})
