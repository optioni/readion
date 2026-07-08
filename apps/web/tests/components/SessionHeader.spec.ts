import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import SessionHeader from '~/components/SessionHeader.vue'
import { useCertDetail } from '~/composables/useCertDetail'

vi.mock('~/composables/useCertDetail', () => ({ useCertDetail: vi.fn() }))

function stubCert(options: { code?: string; name?: string } = {}) {
  vi.mocked(useCertDetail).mockReturnValue({
    name: computed(() => options.name ?? 'Solutions Architect – Associate'),
    provider: computed(() => 'AWS'),
    code: computed(() => options.code ?? 'SAA-C03'),
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
    elapsed?: string
    completedCount?: number
    totalCount?: number
  } = {},
) {
  return mount(SessionHeader, {
    props: {
      userCertificationId: 'enr-1',
      elapsed: '18:42',
      completedCount: 3,
      totalCount: 12,
      ...props,
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  stubCert()
})

describe('SessionHeader cert chip', () => {
  it('resolves the cert code and name for the enrollment', () => {
    const wrapper = mountHeader()
    expect(useCertDetail).toHaveBeenCalledWith('enr-1')
    const header = wrapper.find('[data-testid="session-header"]')
    expect(header.exists()).toBe(true)
    expect(header.text()).toContain('SAA-C03')
    expect(header.text()).toContain('Solutions Architect – Associate')
  })
})

describe('SessionHeader timer and progress', () => {
  it('renders the elapsed timer value passed in', () => {
    const wrapper = mountHeader({ elapsed: '21:08' })
    expect(wrapper.find('[data-testid="session-timer"]').text()).toBe('21:08')
  })

  it('renders the completed/total progress count and bar width', () => {
    const wrapper = mountHeader({ completedCount: 3, totalCount: 12 })
    const progress = wrapper.find('[data-testid="session-progress"]')
    expect(progress.text()).toContain('3')
    expect(progress.text()).toContain('12')
    const bar = wrapper.find('[data-testid="session-progress-bar"]')
    expect(bar.attributes('style')).toContain('width: 25%')
  })

  it('renders a zero-width bar when there are no items', () => {
    const wrapper = mountHeader({ completedCount: 0, totalCount: 0 })
    const bar = wrapper.find('[data-testid="session-progress-bar"]')
    expect(bar.attributes('style')).toContain('width: 0%')
  })
})

describe('SessionHeader end session', () => {
  it('emits end when the end-session button is clicked', async () => {
    const wrapper = mountHeader()
    await wrapper.find('[data-testid="end-session-button"]').trigger('click')
    expect(wrapper.emitted('end')).toHaveLength(1)
  })
})
