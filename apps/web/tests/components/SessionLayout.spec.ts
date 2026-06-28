import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SessionLayout from '~/components/SessionLayout.vue'

function mountLayout() {
  return mount(SessionLayout, {
    slots: {
      header: '<div data-testid="slot-header">H</div>',
      content: '<div data-testid="slot-content">C</div>',
      agent: '<div data-testid="slot-agent">A</div>',
    },
  })
}

describe('SessionLayout structure', () => {
  it('renders the split panel with content and agent regions and projects every slot', () => {
    const wrapper = mountLayout()
    expect(wrapper.find('[data-testid="session-split-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="session-content"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="agent-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="slot-header"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="slot-content"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="slot-agent"]').exists()).toBe(true)
  })

  it('starts with the agent panel expanded', () => {
    const wrapper = mountLayout()
    const panel = wrapper.find('[data-testid="agent-panel"]')
    expect(panel.attributes('data-collapsed')).toBe('false')
    expect(wrapper.find('[data-testid="slot-agent"]').exists()).toBe(true)
  })
})

describe('SessionLayout agent collapse', () => {
  it('collapses the agent panel and hides its body, then re-expands it', async () => {
    const wrapper = mountLayout()
    const toggle = wrapper.find('[data-testid="agent-panel-toggle"]')

    await toggle.trigger('click')
    expect(wrapper.find('[data-testid="agent-panel"]').attributes('data-collapsed')).toBe('true')
    expect(wrapper.find('[data-testid="slot-agent"]').exists()).toBe(false)

    await wrapper.find('[data-testid="agent-panel-toggle"]').trigger('click')
    expect(wrapper.find('[data-testid="agent-panel"]').attributes('data-collapsed')).toBe('false')
    expect(wrapper.find('[data-testid="slot-agent"]').exists()).toBe(true)
  })
})
