import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProgressDomainRow from '~/components/ProgressDomainRow.vue'
import { suppressDomain } from '~/composables/progressApi'
import { progressQueryKeys } from '~/composables/progressQueryKeys'

vi.mock('~/composables/progressApi', () => ({
  suppressDomain: vi.fn(),
}))

const mockInvalidateQueries = vi.fn()

vi.mock('@tanstack/vue-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}))

function mountRow(
  options: {
    domain?: string
    score?: number | null
    status?: 'poor' | 'warning' | 'medium' | 'good' | null
    hasData?: boolean
    delta?: number | null
    enrollmentId?: string
  } = {},
) {
  return mount(ProgressDomainRow, {
    props: {
      domain: options.domain ?? 'Secure Architectures',
      score: options.score ?? 41,
      status: options.status ?? 'poor',
      hasData: options.hasData ?? true,
      delta: options.delta ?? null,
      enrollmentId: options.enrollmentId ?? 'enr-1',
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(suppressDomain).mockResolvedValue({ suppressedCount: 1 })
  mockInvalidateQueries.mockResolvedValue(undefined)
})

describe('ProgressDomainRow — structure', () => {
  it('renders the progress-domain-row testid', () => {
    const wrapper = mountRow()
    expect(wrapper.find('[data-testid="progress-domain-row"]').exists()).toBe(true)
  })

  it('shows the domain name', () => {
    const wrapper = mountRow({ domain: 'Resilient Architectures' })
    expect(wrapper.text()).toContain('Resilient Architectures')
  })

  it('shows the score percentage when hasData is true', () => {
    const wrapper = mountRow({ score: 41, hasData: true })
    expect(wrapper.text()).toContain('41%')
  })

  it('shows "no data yet" placeholder when hasData is false', () => {
    const wrapper = mountRow({ score: null, status: null, hasData: false })
    expect(wrapper.text().toLowerCase()).toContain('no data')
    expect(wrapper.text()).not.toContain('%')
  })
})

describe('ProgressDomainRow — status colour', () => {
  it('applies the status colour class for the score', () => {
    const wrapper = mountRow({ score: 41, status: 'poor', hasData: true })
    expect(wrapper.find('[data-testid="progress-domain-row"]').html()).toContain(
      'text-readion-status-poor',
    )
  })

  it('applies the medium colour class', () => {
    const wrapper = mountRow({ score: 68, status: 'medium', hasData: true })
    expect(wrapper.find('[data-testid="progress-domain-row"]').html()).toContain(
      'text-readion-status-medium',
    )
  })
})

describe('ProgressDomainRow — delta badge', () => {
  it('shows the domain-delta badge when a delta is provided', () => {
    const wrapper = mountRow({ delta: 12 })
    expect(wrapper.find('[data-testid="domain-delta"]').exists()).toBe(true)
  })

  it('does not render domain-delta when delta is null', () => {
    const wrapper = mountRow({ delta: null })
    expect(wrapper.find('[data-testid="domain-delta"]').exists()).toBe(false)
  })

  it('renders a positive delta with the DeltaBadge', () => {
    const wrapper = mountRow({ delta: 12 })
    const delta = wrapper.find('[data-testid="domain-delta"]')
    expect(delta.text()).toContain('12')
  })

  it('renders a negative delta with the DeltaBadge', () => {
    const wrapper = mountRow({ delta: -4 })
    const delta = wrapper.find('[data-testid="domain-delta"]')
    expect(delta.text()).toContain('4')
  })
})

describe('ProgressDomainRow — mark mastered', () => {
  it('renders the mark-mastered-button', () => {
    const wrapper = mountRow()
    expect(wrapper.find('[data-testid="mark-mastered-button"]').exists()).toBe(true)
  })

  it('calls suppressDomain and sets mastered state on click', async () => {
    const wrapper = mountRow({ domain: 'Secure Architectures', enrollmentId: 'enr-1' })
    await wrapper.find('[data-testid="mark-mastered-button"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    expect(vi.mocked(suppressDomain)).toHaveBeenCalledWith('enr-1', {
      domain: 'Secure Architectures',
    })
    expect(wrapper.find('[data-testid="progress-domain-row"]').attributes('data-state')).toBe(
      'mastered',
    )
  })

  it('does not render unretire-button', () => {
    const wrapper = mountRow()
    expect(wrapper.find('[data-testid="unretire-button"]').exists()).toBe(false)
  })

  it('invalidates both weak-areas and review-queue queries after suppress-domain (W3)', async () => {
    const wrapper = mountRow({ domain: 'Secure Architectures', enrollmentId: 'enr-1' })
    await wrapper.find('[data-testid="mark-mastered-button"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: progressQueryKeys.weakAreas('enr-1'),
    })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: progressQueryKeys.reviewQueue('enr-1'),
    })
  })
})
