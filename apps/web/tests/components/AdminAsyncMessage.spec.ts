import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AdminAsyncMessage from '~/components/admin/AdminAsyncMessage.vue'

describe('AdminAsyncMessage', () => {
  it('renders a loading spinner and message', () => {
    const wrapper = mount(AdminAsyncMessage, {
      props: { kind: 'loading', message: 'Loading certifications…' },
    })

    expect(wrapper.find('[data-testid="admin-async-message"]').attributes('data-kind')).toBe(
      'loading',
    )
    expect(wrapper.find('[data-testid="admin-async-spinner"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Loading certifications…')
    expect(wrapper.find('[data-testid="admin-async-retry-btn"]').exists()).toBe(false)
  })

  it('renders an error state with a Retry action that emits retry', async () => {
    const wrapper = mount(AdminAsyncMessage, {
      props: { kind: 'error', message: 'Could not load. Please try again.' },
    })

    expect(wrapper.find('[data-testid="admin-async-message"]').attributes('data-kind')).toBe(
      'error',
    )
    expect(wrapper.find('[data-testid="admin-async-error-icon"]').exists()).toBe(true)
    const retryBtn = wrapper.find('[data-testid="admin-async-retry-btn"]')
    expect(retryBtn.exists()).toBe(true)
    expect(retryBtn.text()).toBe('Retry')

    await retryBtn.trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})
