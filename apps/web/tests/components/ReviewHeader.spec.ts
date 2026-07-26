import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import ReviewHeader from '~/components/ReviewHeader.vue'
import { useCertDetail } from '~/composables/useCertDetail'

vi.mock('~/composables/useCertDetail', () => ({ useCertDetail: vi.fn() }))

const NuxtLinkStub = { props: ['to'], template: '<a :href="to"><slot /></a>' }

function stubCert(code = 'SAA-C03') {
  vi.mocked(useCertDetail).mockReturnValue({
    name: computed(() => 'Solutions Architect – Associate'),
    provider: computed(() => 'AWS'),
    code: computed(() => code),
    certificationId: computed(() => 'cert-1'),
    domains: computed(() => []),
    questionCount: computed(() => 65),
    passingScore: computed(() => null),
    isLoading: computed(() => false),
    isError: computed(() => false),
    notFound: computed(() => false),
  })
}

function mountHeader(
  props: {
    userCertificationId?: string
    current?: number
    total?: number
    timeStr?: string
    timeUrgent?: boolean
  } = {},
) {
  return mount(ReviewHeader, {
    props: {
      userCertificationId: 'enr-1',
      current: 0,
      total: 5,
      ...props,
    },
    global: { stubs: { NuxtLink: NuxtLinkStub } },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  stubCert()
})

describe('ReviewHeader', () => {
  it('renders the review-header root', () => {
    const wrapper = mountHeader()
    expect(wrapper.find('[data-testid="review-header"]').exists()).toBe(true)
  })

  it('uses compact mobile chrome and expands the progress track at the small breakpoint', () => {
    const wrapper = mountHeader()
    const header = wrapper.find('[data-testid="review-header"]')
    const progress = wrapper.find('[data-testid="review-header-progress"]')

    expect(header.classes()).toEqual(expect.arrayContaining(['min-w-0', 'px-3', 'sm:px-7']))
    expect(progress.classes()).toEqual(expect.arrayContaining(['w-16', 'sm:w-[120px]']))
    expect(wrapper.find('a[href="/"] span').classes()).toEqual(
      expect.arrayContaining(['hidden', 'sm:inline']),
    )
  })

  it('resolves the cert code for the enrollment and shows it in the chip', () => {
    const wrapper = mountHeader({ userCertificationId: 'enr-1' })
    expect(useCertDetail).toHaveBeenCalledWith('enr-1')
    expect(wrapper.find('[data-testid="review-header-cert-chip"]').text()).toBe('SAA-C03')
  })

  it('shows the "Quick review" label', () => {
    const wrapper = mountHeader()
    expect(wrapper.text()).toContain('Quick review')
  })

  it('renders a back-to-dashboard affordance linking to /', () => {
    const wrapper = mountHeader()
    expect(wrapper.text()).toContain('Dashboard')
    const link = wrapper.find('a[href="/"]')
    expect(link.exists()).toBe(true)
  })

  it('binds the progress bar width to current/total', () => {
    const wrapper = mountHeader({ current: 2, total: 5 })
    const bar = wrapper.find('[data-testid="review-header-progress"]')
    expect(bar.exists()).toBe(true)
    const fill = bar.find('div')
    expect(fill.attributes('style')).toContain('width: 40%')
  })

  it('renders a zero-width progress bar when total is 0', () => {
    const wrapper = mountHeader({ current: 0, total: 0 })
    const bar = wrapper.find('[data-testid="review-header-progress"]')
    const fill = bar.find('div')
    expect(fill.attributes('style')).toContain('width: 0%')
  })

  it('shows the current/total counter', () => {
    const wrapper = mountHeader({ current: 2, total: 5 })
    expect(wrapper.text()).toContain('2')
    expect(wrapper.text()).toContain('/5')
  })

  it('shows a static 5:00 timer by default', () => {
    const wrapper = mountHeader()
    expect(wrapper.find('[data-testid="review-header-timer"]').text()).toContain('5:00')
  })

  it('shows a custom timeStr when provided', () => {
    const wrapper = mountHeader({ timeStr: '3:42' })
    expect(wrapper.find('[data-testid="review-header-timer"]').text()).toContain('3:42')
  })

  it('applies urgent styling when timeUrgent is true', () => {
    const wrapper = mountHeader({ timeUrgent: true })
    const timer = wrapper.find('[data-testid="review-header-timer"]')
    expect(timer.classes().join(' ')).toContain('readion-status-poor')
  })
})
