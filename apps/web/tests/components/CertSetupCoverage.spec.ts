import type { CoverageReportDto } from '~~/src/api/model/coverageReportDto'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CertSetupCoverage from '~/components/admin/CertSetupCoverage.vue'
import { certificationCoverageControllerCoverage } from '~~/src/api/certification-coverage/certification-coverage'

vi.mock('~~/src/api/certification-coverage/certification-coverage')

const CERT_ID = 'c0000000-0000-0000-0000-000000000002'

const COVERAGE: CoverageReportDto = {
  domains: [
    { name: 'Secure', chunkCount: 142, chunkThreshold: 120, enabledSourceCount: 3, met: true },
    { name: 'Resilient', chunkCount: 30, chunkThreshold: 120, enabledSourceCount: 1, met: false },
  ],
  totalChunks: 172,
  totalThreshold: 240,
  state: 'draft',
  met: false,
}

function coverageEnvelope(report: CoverageReportDto = COVERAGE) {
  // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
  return { data: { data: report }, status: 200, headers: new Headers() } as any
}

function mountCoverage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return mount(CertSetupCoverage, {
    props: { certId: CERT_ID },
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('CertSetupCoverage', () => {
  it('renders the coverage root immediately and the per-domain bars once loaded', async () => {
    vi.mocked(certificationCoverageControllerCoverage).mockResolvedValue(coverageEnvelope())
    const wrapper = mountCoverage()

    expect(wrapper.find('[data-testid="cert-coverage"]').exists()).toBe(true)

    await flushPromises()

    expect(certificationCoverageControllerCoverage).toHaveBeenCalledWith(CERT_ID)
    const bars = wrapper.findAll('[data-testid="coverage-domain-bar"]')
    expect(bars).toHaveLength(2)
    expect(bars[0]!.text()).toContain('Secure')
    expect(bars[0]!.text()).toContain('142')
  })

  it('caps the bar width at 100% when chunks exceed the threshold', async () => {
    vi.mocked(certificationCoverageControllerCoverage).mockResolvedValue(coverageEnvelope())
    const wrapper = mountCoverage()
    await flushPromises()

    const fill = wrapper.find(
      '[data-testid="coverage-domain-bar"] [data-testid="coverage-bar-fill"]',
    )
    expect(fill.attributes('style')).toContain('width: 100%')
  })

  it('renders the overall threshold summary and no publish or sign-off controls', async () => {
    vi.mocked(certificationCoverageControllerCoverage).mockResolvedValue(coverageEnvelope())
    const wrapper = mountCoverage()
    await flushPromises()

    const overall = wrapper.find('[data-testid="cert-coverage-overall"]')
    expect(overall.exists()).toBe(true)
    expect(overall.text()).toContain('172')
    expect(overall.text()).toContain('240')
    expect(wrapper.find('[data-testid="publish-cert-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="admin-review-signoff"]').exists()).toBe(false)
  })
})
