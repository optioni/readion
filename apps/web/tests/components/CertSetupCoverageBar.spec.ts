import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CertSetupCoverageBar from '~/components/admin/CertSetupCoverageBar.vue'

function mountBar(props: {
  name: string
  chunkCount: number
  chunkThreshold: number
  met: boolean
}) {
  return mount(CertSetupCoverageBar, { props })
}

describe('CertSetupCoverageBar', () => {
  it('renders the domain name, chunk counts and met label', () => {
    const wrapper = mountBar({ name: 'Secure', chunkCount: 30, chunkThreshold: 120, met: false })

    expect(wrapper.attributes('data-domain')).toBe('Secure')
    expect(wrapper.text()).toContain('Secure')
    expect(wrapper.text()).toContain('30 / 120')
    expect(wrapper.text()).toContain('Below threshold')
  })

  it('shows the met label and proportional width below threshold', () => {
    const wrapper = mountBar({ name: 'Secure', chunkCount: 30, chunkThreshold: 120, met: true })

    expect(wrapper.text()).toContain('Met')
    expect(wrapper.find('[data-testid="coverage-bar-fill"]').attributes('style')).toContain(
      'width: 25%',
    )
  })

  it('caps the width at 100% when chunks exceed the threshold', () => {
    const wrapper = mountBar({ name: 'Secure', chunkCount: 200, chunkThreshold: 120, met: true })

    expect(wrapper.find('[data-testid="coverage-bar-fill"]').attributes('style')).toContain(
      'width: 100%',
    )
  })

  it('treats a zero threshold as fully covered', () => {
    const wrapper = mountBar({ name: 'Secure', chunkCount: 0, chunkThreshold: 0, met: true })

    expect(wrapper.find('[data-testid="coverage-bar-fill"]').attributes('style')).toContain(
      'width: 100%',
    )
  })
})
