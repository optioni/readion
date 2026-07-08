import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AgentStarAvatar from '~/components/agent/AgentStarAvatar.vue'

describe('AgentStarAvatar', () => {
  it('defaults to the small header size', () => {
    const wrapper = mount(AgentStarAvatar)
    expect(wrapper.classes()).toContain('h-7')
    expect(wrapper.classes()).toContain('w-7')
    expect(wrapper.classes()).not.toContain('h-12')
  })

  it('renders the small header variant without the empty-state border', () => {
    const wrapper = mount(AgentStarAvatar, { props: { size: 'sm' } })
    expect(wrapper.classes()).toContain('h-7')
    expect(wrapper.classes()).toContain('w-7')
    expect(wrapper.classes()).not.toContain('border')
  })

  it('renders the large empty-state variant with its border', () => {
    const wrapper = mount(AgentStarAvatar, { props: { size: 'lg' } })
    expect(wrapper.classes()).toContain('h-12')
    expect(wrapper.classes()).toContain('w-12')
    expect(wrapper.classes()).toContain('border')
  })

  it('is always rendered as a rounded-full circle', () => {
    const wrapper = mount(AgentStarAvatar, { props: { size: 'lg' } })
    expect(wrapper.classes()).toContain('rounded-full')
  })

  it('renders the star path icon', () => {
    const wrapper = mount(AgentStarAvatar)
    expect(wrapper.find('path').exists()).toBe(true)
  })
})
