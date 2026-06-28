import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { useCertDetail } from '~/composables/useCertDetail'
import CertDetailPage from '~/pages/user-certifications/[id]/index.vue'

vi.mock('~/composables/useCertDetail', () => ({ useCertDetail: vi.fn() }))

vi.stubGlobal('useRoute', () => ({ params: { id: 'enr-1' } }))

function stubCertDetail(
  options: {
    name?: string
    provider?: string
    code?: string
    certificationId?: string
    isLoading?: boolean
    isError?: boolean
    notFound?: boolean
  } = {},
) {
  vi.mocked(useCertDetail).mockReturnValue({
    name: computed(() => options.name ?? 'AWS Cloud Practitioner'),
    provider: computed(() => options.provider ?? 'AWS'),
    code: computed(() => options.code ?? 'CLF-C02'),
    certificationId: computed(() => options.certificationId ?? 'cert-1'),
    domains: computed(() => []),
    isLoading: computed(() => options.isLoading ?? false),
    isError: computed(() => options.isError ?? false),
    notFound: computed(() => options.notFound ?? false),
  })
}

function mountPage() {
  return mount(CertDetailPage, {
    global: {
      stubs: {
        OverviewTab: { template: '<div data-testid="overview-tab-stub" />' },
        SessionsTab: { template: '<div data-testid="sessions-tab-stub" />' },
        ExamHistoryTab: { template: '<div data-testid="exam-history-tab-stub" />' },
      },
    },
  })
}

function tabs(wrapper: ReturnType<typeof mountPage>) {
  return wrapper.findAll('[role="tab"]')
}

function tabByName(wrapper: ReturnType<typeof mountPage>, pattern: RegExp) {
  return tabs(wrapper).find((tab) => pattern.test(tab.text()))
}

beforeEach(() => {
  vi.clearAllMocks()
  stubCertDetail()
})

describe('Cert detail page header', () => {
  it('renders the certification name and provider in the header', () => {
    stubCertDetail({ name: 'Azure Fundamentals', provider: 'Microsoft' })
    const wrapper = mountPage()
    const page = wrapper.find('[data-testid="cert-detail-page"]')
    expect(page.exists()).toBe(true)
    expect(page.text()).toContain('Azure Fundamentals')
    expect(page.text()).toContain('Microsoft')
  })
})

describe('Cert detail tab strip', () => {
  it('renders Overview, Sessions and Exam History tabs', () => {
    const wrapper = mountPage()
    const names = tabs(wrapper).map((tab) => tab.text())
    expect(names.some((name) => /overview/i.test(name))).toBe(true)
    expect(names.some((name) => /sessions/i.test(name))).toBe(true)
    expect(names.some((name) => /exam history/i.test(name))).toBe(true)
  })

  it('defaults to the Overview tab as selected', () => {
    const wrapper = mountPage()
    expect(tabByName(wrapper, /overview/i)?.attributes('aria-selected')).toBe('true')
    expect(tabByName(wrapper, /sessions/i)?.attributes('aria-selected')).toBe('false')
    expect(tabByName(wrapper, /exam history/i)?.attributes('aria-selected')).toBe('false')
  })

  it('exposes a tabpanel per tab', () => {
    const wrapper = mountPage()
    expect(wrapper.findAll('[role="tabpanel"]')).toHaveLength(3)
    expect(wrapper.find('[data-testid="cert-detail-tab-overview"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cert-detail-tab-sessions"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cert-detail-tab-exam-history"]').exists()).toBe(true)
  })

  it('activates a tab when it is clicked', async () => {
    const wrapper = mountPage()
    await tabByName(wrapper, /sessions/i)?.trigger('click')
    expect(tabByName(wrapper, /sessions/i)?.attributes('aria-selected')).toBe('true')
    expect(tabByName(wrapper, /overview/i)?.attributes('aria-selected')).toBe('false')
  })
})

describe('Cert detail not-found state', () => {
  it('renders the not-found state and no tabs when the enrollment is not found', () => {
    stubCertDetail({ notFound: true })
    const wrapper = mountPage()
    expect(wrapper.find('[data-testid="cert-detail-not-found"]').exists()).toBe(true)
    expect(tabs(wrapper)).toHaveLength(0)
  })
})
