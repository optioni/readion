import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import WeakAreasPanel from '~/components/WeakAreasPanel.vue'
import type { WeakAreaResponseDto } from '~~/src/api/model'

const weakArea = (domain: string, score: number): WeakAreaResponseDto => ({
  id: domain,
  domain,
  score,
  accuracy: 0,
  meanConfidence: 0,
  responseCount: 0,
})

describe('WeakAreasPanel', () => {
  it('renders each weak area as an inline DomainBadge chip', () => {
    const wrapper = mount(WeakAreasPanel, {
      props: {
        weakAreas: [weakArea('Billing', 48), weakArea('Security', 61), weakArea('Networking', 70)],
      },
    })
    const badges = wrapper.findAll('[data-testid="domain-badge"]')
    expect(badges).toHaveLength(3)
    expect(badges[0]?.text()).toContain('Billing')
    expect(badges[0]?.text()).toContain('48%')
  })

  it('does not render a bordered text list', () => {
    const wrapper = mount(WeakAreasPanel, {
      props: { weakAreas: [weakArea('Billing', 48)] },
    })
    expect(wrapper.find('[data-testid="weak-area-row"]').exists()).toBe(false)
  })

  it('colours each chip on the status scale', () => {
    const wrapper = mount(WeakAreasPanel, {
      props: {
        weakAreas: [weakArea('Billing', 48), weakArea('Security', 61), weakArea('Networking', 70)],
      },
    })
    const dots = wrapper.findAll('[data-testid="domain-badge-dot"]')
    expect(dots[0]?.classes()).toContain('bg-readion-status-poor')
    expect(dots[1]?.classes()).toContain('bg-readion-status-warning')
    expect(dots[2]?.classes()).toContain('bg-readion-status-medium')
  })

  it('shows the "No data yet" placeholder when there are no weak areas', () => {
    const wrapper = mount(WeakAreasPanel, { props: { weakAreas: [] } })
    expect(wrapper.text()).toContain('No data yet')
    expect(wrapper.find('[data-testid="domain-badge"]').exists()).toBe(false)
  })
})
