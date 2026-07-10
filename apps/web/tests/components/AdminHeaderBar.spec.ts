import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AdminHeaderBar from '~/components/admin/AdminHeaderBar.vue'

describe('AdminHeaderBar', () => {
  it('renders the title in a bordered header bar', () => {
    const wrapper = mount(AdminHeaderBar, { props: { title: 'Certifications' } })

    const bar = wrapper.find('[data-testid="admin-header-bar"]')
    expect(bar.exists()).toBe(true)
    expect(wrapper.find('[data-testid="admin-header-bar-title"]').text()).toBe('Certifications')
  })

  it('renders an optional subtitle', () => {
    const wrapper = mount(AdminHeaderBar, {
      props: { title: 'Certifications', subtitle: 'Manage certifications and their metadata.' },
    })

    expect(wrapper.find('[data-testid="admin-header-bar-subtitle"]').text()).toBe(
      'Manage certifications and their metadata.',
    )
  })

  it('omits the subtitle element when none is given', () => {
    const wrapper = mount(AdminHeaderBar, { props: { title: 'Sources' } })

    expect(wrapper.find('[data-testid="admin-header-bar-subtitle"]').exists()).toBe(false)
  })

  it('renders slotted actions on the trailing side', () => {
    const wrapper = mount(AdminHeaderBar, {
      props: { title: 'Certifications' },
      slots: { default: '<button data-testid="my-action">Action</button>' },
    })

    expect(wrapper.find('[data-testid="my-action"]').exists()).toBe(true)
  })
})
