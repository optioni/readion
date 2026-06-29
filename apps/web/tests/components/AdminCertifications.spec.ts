import type { CertExtractionFields } from '@readion/shared'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import AdminCertifications from '~/components/admin/AdminCertifications.vue'
import { certificationsControllerDetail } from '~~/src/api/certifications/certifications'
import {
  certSetupControllerDiscoverSources,
  certSetupControllerExtract,
  certSetupControllerReadExtraction,
  certSetupControllerReverify,
} from '~~/src/api/cert-setup/cert-setup'

vi.mock('~~/src/api/certifications/certifications')
vi.mock('~~/src/api/cert-setup/cert-setup')

const dueData = ref<unknown[]>([])
const dueLoading = ref(false)
const dueError = ref(false)

vi.mock('~/composables/useDueForReverification', () => ({
  useDueForReverification: () => ({
    data: dueData,
    isLoading: dueLoading,
    isError: dueError,
  }),
}))

const CERT_ID = 'c0000000-0000-0000-0000-000000000001'

const SOURCE_URL =
  'https://aws.amazon.com/certification/certified-solutions-architect-associate/'

const CITATION = { url: SOURCE_URL, passage: 'minimum passing score of 720 (~67%)' }

const DUE_ITEM = {
  id: CERT_ID,
  name: 'AWS Certified Solutions Architect — Associate',
  code: 'SAA-C03',
  verifiedAt: '2025-06-01T00:00:00.000Z',
  dueForReverification: true,
}

const CURRENT_CERT = {
  id: CERT_ID,
  name: 'AWS Certified Solutions Architect — Associate',
  provider: 'AWS',
  code: 'SAA-C03',
  domains: [
    { name: 'Secure Architectures', weight: 30 },
    { name: 'Resilient Architectures', weight: 26 },
    { name: 'High-Performing Architectures', weight: 24 },
    { name: 'Cost-Optimized Architectures', weight: 20 },
  ],
  questionCount: 65,
  passingScore: 72,
  timeLimitMinutes: 130,
  state: 'live',
}

const DISCOVER_RESPONSE = {
  candidates: [
    { url: SOURCE_URL, title: 'AWS SAA', snippet: 'official guide' },
    { url: 'https://d1.awsstatic.com/SAA-C03.pdf', title: 'PDF', snippet: 'guide' },
  ],
  suggestedContentSources: [],
}

const EXTRACTION_FIELDS: CertExtractionFields = {
  domains: { value: CURRENT_CERT.domains, citation: { url: SOURCE_URL, passage: 'domains' } },
  questionCount: { unverified: true },
  passingScore: { value: 67, citation: CITATION },
  timeLimitMinutes: { value: 130, citation: { url: SOURCE_URL, passage: '130 minutes' } },
}

function envelope(data: unknown) {
  // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
  return { data: { data }, status: 200, headers: new Headers() } as any
}

function mountComponent() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return mount(AdminCertifications, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]], stubs: { NuxtLink: true } },
  })
}

async function flush(times = 8) {
  for (let i = 0; i < times; i += 1) {
    await flushPromises()
    await nextTick()
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  dueData.value = [DUE_ITEM]
  dueLoading.value = false
  dueError.value = false
  vi.mocked(certificationsControllerDetail).mockResolvedValue(envelope(CURRENT_CERT))
  vi.mocked(certSetupControllerDiscoverSources).mockResolvedValue(envelope(DISCOVER_RESPONSE))
  vi.mocked(certSetupControllerExtract).mockResolvedValue(
    envelope({ jobId: 'extract-job-1', state: 'active' }),
  )
  vi.mocked(certSetupControllerReverify).mockResolvedValue(envelope(CURRENT_CERT))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AdminCertifications due list', () => {
  it('renders a due-for-reverification row keyed by cert id with a reverify button', () => {
    const wrapper = mountComponent()
    const row = wrapper.find(`[data-testid="due-reverification-row"][data-cert-id="${CERT_ID}"]`)
    expect(row.exists()).toBe(true)
    expect(row.find('[data-testid="reverify-btn"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('AWS Certified Solutions Architect')
    wrapper.unmount()
  })

  it('shows a loading state', () => {
    dueLoading.value = true
    const wrapper = mountComponent()
    expect(wrapper.find('[data-testid="due-loading"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows an error state', () => {
    dueError.value = true
    const wrapper = mountComponent()
    expect(wrapper.find('[data-testid="due-error"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows an empty state when nothing is due', () => {
    dueData.value = []
    const wrapper = mountComponent()
    expect(wrapper.find('[data-testid="due-empty"]').exists()).toBe(true)
    wrapper.unmount()
  })
})

describe('AdminCertifications reverify flow', () => {
  it('reads current values, re-runs discover + extract, and shows a client-side diff', async () => {
    vi.mocked(certSetupControllerReadExtraction).mockResolvedValue(
      envelope({ state: 'completed', fields: EXTRACTION_FIELDS }),
    )
    const wrapper = mountComponent()

    await wrapper.find('[data-testid="reverify-btn"]').trigger('click')
    await flush()

    expect(certificationsControllerDetail).toHaveBeenCalledWith(CERT_ID, expect.anything())
    expect(certSetupControllerDiscoverSources).toHaveBeenCalled()
    expect(certSetupControllerExtract).toHaveBeenCalled()

    const diff = wrapper.find('[data-testid="reverify-diff"]')
    expect(diff.exists()).toBe(true)
    // passingScore 72 -> 67
    expect(diff.text()).toContain('72')
    expect(diff.text()).toContain('67')
    // unverified questionCount keeps the current value
    expect(diff.text()).toContain('65')

    wrapper.unmount()
  })

  it('submits reverify with the accepted proposed values + provenance', async () => {
    vi.mocked(certSetupControllerReadExtraction).mockResolvedValue(
      envelope({ state: 'completed', fields: EXTRACTION_FIELDS }),
    )
    const wrapper = mountComponent()

    await wrapper.find('[data-testid="reverify-btn"]').trigger('click')
    await flush()
    await wrapper.find('[data-testid="reverify-submit-btn"]').trigger('click')
    await flush()

    expect(certSetupControllerReverify).toHaveBeenCalledTimes(1)
    const [id, options] = vi.mocked(certSetupControllerReverify).mock.calls[0]
    expect(id).toBe(CERT_ID)
    const body = JSON.parse((options as { body: string }).body)
    expect(body).toMatchObject({
      confirmedSourceUrl: SOURCE_URL,
      questionCount: 65,
      passingScore: 67,
      timeLimitMinutes: 130,
    })
    expect(body.domains).toHaveLength(4)
    expect(body.provenance.passingScore).toEqual({ url: SOURCE_URL, passage: CITATION.passage })
    expect(body.provenance.questionCount).toEqual({ unverified: true })

    wrapper.unmount()
  })

  it('polls through an in-flight extraction before composing the diff', async () => {
    vi.mocked(certSetupControllerReadExtraction)
      .mockResolvedValueOnce(envelope({ state: 'active', fields: null }))
      .mockResolvedValue(envelope({ state: 'completed', fields: EXTRACTION_FIELDS }))
    const wrapper = mountComponent()

    await wrapper.find('[data-testid="reverify-btn"]').trigger('click')
    await flush()
    expect(wrapper.find('[data-testid="reverify-diff"]').exists()).toBe(false)

    await vi.waitFor(
      () => {
        expect(wrapper.find('[data-testid="reverify-diff"]').exists()).toBe(true)
      },
      { timeout: 4000, interval: 100 },
    )

    expect(certSetupControllerReadExtraction).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('surfaces an error when extraction terminates with no fields', async () => {
    vi.mocked(certSetupControllerReadExtraction).mockResolvedValue(
      envelope({ state: 'failed', fields: null }),
    )
    const wrapper = mountComponent()

    await wrapper.find('[data-testid="reverify-btn"]').trigger('click')
    await flush()

    expect(wrapper.find('[data-testid="reverify-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="reverify-diff"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
