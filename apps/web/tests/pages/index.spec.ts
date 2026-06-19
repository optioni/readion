import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import IndexPage from '~/pages/index.vue'

describe('Index page', () => {
  it('renders the placeholder page with app name', () => {
    const wrapper = mount(IndexPage)
    expect(wrapper.html()).toContain('Readion')
  })
})
