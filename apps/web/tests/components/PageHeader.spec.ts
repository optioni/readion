import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PageHeader from '~/components/PageHeader.vue'

describe('PageHeader', () => {
  it('renders the eyebrow text', () => {
    const wrapper = mount(PageHeader, {
      props: { eyebrow: 'DASHBOARD', title: 'Your certifications' },
    })
    expect(wrapper.text()).toContain('DASHBOARD')
  })

  it('renders the title as an h1', () => {
    const wrapper = mount(PageHeader, {
      props: { eyebrow: 'DASHBOARD', title: 'Your certifications' },
    })
    const heading = wrapper.find('h1')
    expect(heading.exists()).toBe(true)
    expect(heading.text()).toBe('Your certifications')
  })

  it('renders a right-aligned "N active" indicator with a green status dot when activeCount is provided', () => {
    const wrapper = mount(PageHeader, {
      props: { eyebrow: 'DASHBOARD', title: 'Your certifications', activeCount: 2 },
    })
    expect(wrapper.text()).toContain('2 active')
    const indicator = wrapper.find('[data-testid="page-header-active"]')
    expect(indicator.exists()).toBe(true)
    expect(indicator.find('.bg-readion-status-good').exists()).toBe(true)
  })

  it('omits the active-count indicator when activeCount is not provided', () => {
    const wrapper = mount(PageHeader, {
      props: { eyebrow: 'DASHBOARD', title: 'Your certifications' },
    })
    expect(wrapper.find('[data-testid="page-header-active"]').exists()).toBe(false)
  })
})
