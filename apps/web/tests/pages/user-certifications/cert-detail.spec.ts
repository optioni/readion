import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useCertDetail } from '~/composables/useCertDetail'
import { useQuickStartActions } from '~/composables/useQuickStartActions'
import CertDetailPage from '~/pages/user-certifications/[id]/index.vue'

vi.mock('~/composables/useCertDetail', () => ({ useCertDetail: vi.fn() }))
vi.mock('~/composables/useQuickStartActions', () => ({ useQuickStartActions: vi.fn() }))

vi.stubGlobal('useRoute', () => ({ params: { id: 'enr-1' } }))

const startSession = vi.fn()
const startMockExam = vi.fn()

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
    questionCount: computed(() => 65),
    passingScore: computed(() => null),
    isLoading: computed(() => options.isLoading ?? false),
    isError: computed(() => options.isError ?? false),
    notFound: computed(() => options.notFound ?? false),
  })
}

function mountPage() {
  return mount(CertDetailPage, {
    global: {
      stubs: {
        NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
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
  vi.mocked(useQuickStartActions).mockReturnValue({
    startSession,
    startMockExam,
    isStartingSession: ref(false),
    isStartingMockExam: ref(false),
  })
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

  it('uses the full content width rather than a narrow centred column', () => {
    const wrapper = mountPage()
    const page = wrapper.find('[data-testid="cert-detail-page"]')
    const classes = page.classes()
    expect(classes).not.toContain('max-w-[720px]')
    expect(classes).not.toContain('mx-auto')
  })

  it('renders a full-bleed cert header bar with a "← Dashboard / CODE" breadcrumb', () => {
    stubCertDetail({ code: 'SAA-C03' })
    const wrapper = mountPage()
    const page = wrapper.find('[data-testid="cert-detail-page"]')
    expect(page.text()).toMatch(/^←\s*Dashboard/)
    expect(page.text()).toContain('SAA-C03')
  })

  it('wires the header actions to the quick-start composable', async () => {
    const wrapper = mountPage()
    await wrapper.find('[data-testid="cert-header-mock-exam"]').trigger('click')
    await wrapper.find('[data-testid="cert-header-start-session"]').trigger('click')
    expect(startMockExam).toHaveBeenCalledTimes(1)
    expect(startSession).toHaveBeenCalledTimes(1)
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

  it('uses the exact sentence-case label "Exam history", not "Exam History"', () => {
    const wrapper = mountPage()
    const names = tabs(wrapper).map((tab) => tab.text())
    expect(names).toContain('Exam history')
    expect(names).not.toContain('Exam History')
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

describe('Cert detail progress link (4.3)', () => {
  it('does not render an extra "View progress" link between the header and the tab bar', () => {
    const wrapper = mountPage()
    expect(wrapper.find('[data-testid="view-progress-link"]').exists()).toBe(false)
  })
})
