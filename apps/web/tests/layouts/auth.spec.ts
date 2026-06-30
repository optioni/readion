import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AuthLayout from '~/layouts/auth.vue'

function mountLayout(slot: string) {
  return mount(AuthLayout, {
    slots: { default: slot },
  })
}

describe('Auth layout', () => {
  it('wraps page content in a contained, fixed-width card within the form panel', () => {
    const wrapper = mountLayout('<form data-testid="page-content">Sign in</form>')

    const card = wrapper.get('[data-testid="auth-card"]')
    expect(card.find('[data-testid="page-content"]').exists()).toBe(true)

    const classes = card.classes()
    expect(classes).toContain('max-w-sm')
    expect(classes).toContain('rounded-xl')
    expect(classes.some((c) => c.startsWith('border'))).toBe(true)
  })

  it('renders the form panel on the split-panel surface alongside the brand panel', () => {
    const wrapper = mountLayout('<div data-testid="page-content" />')

    expect(wrapper.find('aside').exists()).toBe(true)
    const main = wrapper.get('main')
    expect(main.find('[data-testid="auth-card"]').exists()).toBe(true)
  })
})
