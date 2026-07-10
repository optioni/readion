import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AdminWizardFooter from '~/components/admin/AdminWizardFooter.vue'

describe('AdminWizardFooter', () => {
  it('renders Cancel and the primary CTA in a bordered footer bar', () => {
    const wrapper = mount(AdminWizardFooter, {
      props: { ctaLabel: 'Search for sources →' },
    })

    expect(wrapper.find('[data-testid="wizard-footer"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="wizard-footer-cancel"]').text()).toBe('Cancel')
    expect(wrapper.find('[data-testid="wizard-footer-cta"]').text()).toBe('Search for sources →')
  })

  it('supports overriding the cta/cancel testids for step-specific selectors', () => {
    const wrapper = mount(AdminWizardFooter, {
      props: {
        ctaLabel: 'Confirm',
        ctaTestid: 'identify-search-btn',
        cancelTestid: 'identify-cancel-btn',
      },
    })

    expect(wrapper.find('[data-testid="identify-search-btn"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="identify-cancel-btn"]').exists()).toBe(true)
  })

  it('disables the CTA when ctaDisabled is true', () => {
    const wrapper = mount(AdminWizardFooter, {
      props: { ctaLabel: 'Search', ctaDisabled: true },
    })

    expect(wrapper.find('[data-testid="wizard-footer-cta"]').attributes('disabled')).toBeDefined()
  })

  it('emits cancel and submit', async () => {
    const wrapper = mount(AdminWizardFooter, { props: { ctaLabel: 'Search' } })

    await wrapper.find('[data-testid="wizard-footer-cancel"]').trigger('click')
    await wrapper.find('[data-testid="wizard-footer-cta"]').trigger('click')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('submit')).toHaveLength(1)
  })
})
