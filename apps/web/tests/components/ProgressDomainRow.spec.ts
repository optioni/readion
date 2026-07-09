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
    mastered?: boolean
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
      mastered: options.mastered ?? false,
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
  it('applies the status colour class to the bar fill', () => {
    const wrapper = mountRow({ score: 41, status: 'poor', hasData: true })
    expect(wrapper.find('[data-testid="domain-score-bar-fill"]').classes()).toContain(
      'bg-readion-status-poor',
    )
  })

  it('applies the medium colour class to the bar fill', () => {
    const wrapper = mountRow({ score: 68, status: 'medium', hasData: true })
    expect(wrapper.find('[data-testid="domain-score-bar-fill"]').classes()).toContain(
      'bg-readion-status-medium',
    )
  })
})

describe('ProgressDomainRow — delta badge', () => {
  it('shows exactly one domain-delta badge when a delta is provided', () => {
    const wrapper = mountRow({ delta: 12 })
    expect(wrapper.findAll('[data-testid="domain-delta"]')).toHaveLength(1)
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

describe('ProgressDomainRow — mark mastered (6.1)', () => {
  it('renders the mark-mastered-button when not mastered', () => {
    const wrapper = mountRow({ mastered: false })
    expect(wrapper.find('[data-testid="mark-mastered-button"]').exists()).toBe(true)
  })

  it('does not render the mark-mastered-button when already mastered', () => {
    const wrapper = mountRow({ mastered: true })
    expect(wrapper.find('[data-testid="mark-mastered-button"]').exists()).toBe(false)
  })

  it('calls suppressDomain with the enrollment and domain on click', async () => {
    const wrapper = mountRow({ domain: 'Secure Architectures', enrollmentId: 'enr-1' })
    await wrapper.find('[data-testid="mark-mastered-button"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    expect(vi.mocked(suppressDomain)).toHaveBeenCalledWith('enr-1', {
      domain: 'Secure Architectures',
    })
  })

  it('reflects the mastered state optimistically right after the mutation resolves', async () => {
    const wrapper = mountRow({ mastered: false })
    await wrapper.find('[data-testid="mark-mastered-button"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="progress-domain-row"]').attributes('data-state')).toBe(
      'mastered',
    )
  })

  it('invalidates both weak-areas and review-queue queries after suppress-domain', async () => {
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

  it('reflects the mastered state from the prop alone (no click), simulating a page reload', () => {
    const wrapper = mountRow({ mastered: true })
    expect(wrapper.find('[data-testid="progress-domain-row"]').attributes('data-state')).toBe(
      'mastered',
    )
  })
})

describe('ProgressDomainRow — mastered design treatment (6.2)', () => {
  it('shows the "Mastered" pill and struck-through name when mastered', () => {
    const wrapper = mountRow({ mastered: true, domain: 'Secure Architectures' })
    expect(wrapper.find('[data-testid="mastered-pill"]').exists()).toBe(true)
    const name = wrapper.find('[data-testid="domain-score-bar"] span')
    expect(name.classes()).toContain('line-through')
  })

  it('dims the score bar when mastered', () => {
    const wrapper = mountRow({ mastered: true })
    expect(wrapper.find('[data-testid="domain-score-bar-fill"]').classes()).toContain('opacity-40')
  })

  it('does not render a functional unretire-button (one-way contract)', () => {
    const wrapper = mountRow({ mastered: true })
    expect(wrapper.find('[data-testid="unretire-button"]').exists()).toBe(false)
  })
})
