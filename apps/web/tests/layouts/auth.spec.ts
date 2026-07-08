import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AuthLayout from '~/layouts/auth.vue'

function mountLayout(slot: string) {
  return mount(AuthLayout, {
    slots: { default: slot },
  })
}

describe('Auth layout', () => {
  it('renders the form pane as a full-height background-surface panel, not a bordered card in a background-base void', () => {
    const wrapper = mountLayout('<form data-testid="page-content">Sign in</form>')

    const pane = wrapper.get('main')
    expect(pane.find('[data-testid="page-content"]').exists()).toBe(true)

    const paneClasses = pane.classes()
    expect(paneClasses).toContain('flex-1')
    expect(paneClasses).toContain('bg-readion-background-surface')
    expect(paneClasses).not.toContain('bg-readion-background-base')

    // Vertically centered, left-aligned form content — not a floating card.
    expect(paneClasses).toContain('flex-col')
    expect(paneClasses).toContain('justify-center')
    expect(paneClasses).not.toContain('items-center')

    // No bordered floating card wrapping the slot content.
    expect(pane.find('.rounded-xl').exists()).toBe(false)
    expect(pane.find('[class*="border"]').exists()).toBe(false)
  })

  it('constrains the slotted form content to a comfortable reading width within the filled pane', () => {
    const wrapper = mountLayout('<form data-testid="page-content">Sign in</form>')

    const pane = wrapper.get('main')
    const content = pane.find('[data-testid="page-content"]')
    const wrapperEl = content.element.parentElement
    if (!wrapperEl) {
      throw new Error('expected slot content to have a wrapping element')
    }

    const wrapperClasses = Array.from(wrapperEl.classList)
    expect(wrapperClasses).toContain('max-w-sm')
    expect(wrapperClasses).toContain('w-full')
  })

  it('does not render an SSO control or "or" divider around the slotted content', () => {
    const wrapper = mountLayout(
      '<form data-testid="page-content"><input type="email" /><button type="submit">Sign in</button></form>',
    )

    const html = wrapper.html()
    expect(html).not.toMatch(/sso/i)
    expect(wrapper.findAll('button').some((b) => /sso/i.test(b.text()))).toBe(false)
    expect(wrapper.findAll('*').some((el) => el.text().trim().toLowerCase() === 'or')).toBe(false)
  })

  it('renders the form panel on the split-panel surface alongside the brand panel', () => {
    const wrapper = mountLayout('<div data-testid="page-content" />')

    expect(wrapper.find('aside').exists()).toBe(true)
    const main = wrapper.get('main')
    expect(main.find('[data-testid="page-content"]').exists()).toBe(true)
  })
})
