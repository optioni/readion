import type { CertExtractionFields } from '@readion/shared'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import AdminCertReverify from '~/components/admin/AdminCertReverify.vue'
import {
  certSetupControllerDiscoverSources,
  certSetupControllerExtract,
  certSetupControllerReadExtraction,
  certSetupControllerReverify,
} from '~~/src/api/cert-setup/cert-setup'
import { certificationsControllerDetail } from '~~/src/api/certifications/certifications'

vi.mock('~~/src/api/certifications/certifications')
vi.mock('~~/src/api/cert-setup/cert-setup')

const CERT_ID = 'c0000000-0000-0000-0000-000000000001'
const CODE = 'SAA-C03'
const SOURCE_URL = 'https://aws.amazon.com/certification/certified-solutions-architect-associate/'

const DUE_ITEM = {
  id: CERT_ID,
  name: 'AWS Certified Solutions Architect — Associate',
  code: CODE,
  verifiedAt: '2025-06-01T00:00:00.000Z',
  dueForReverification: true,
}

const CURRENT_CERT = {
  id: CERT_ID,
  name: 'AWS Certified Solutions Architect — Associate',
  provider: 'AWS',
  code: CODE,
  domains: [{ name: 'Secure Architectures', weight: 100 }],
  questionCount: 65,
  passingScore: 72,
  timeLimitMinutes: 130,
  state: 'live',
}

const EXTRACTION_FIELDS: CertExtractionFields = {
  domains: {
    value: [{ name: 'Secure Architectures', weight: 100 }],
    citation: { url: SOURCE_URL, passage: 'domains' },
  },
  questionCount: { unverified: true },
  passingScore: { value: 67, citation: { url: SOURCE_URL, passage: 'passing' } },
  timeLimitMinutes: { value: 130, citation: { url: SOURCE_URL, passage: 'time' } },
}

const dueData = ref<unknown[]>([DUE_ITEM])
const dueLoading = ref(false)
const dueError = ref(false)
const dueRefetch = vi.fn()

vi.mock('~/composables/useDueForReverification', () => ({
  useDueForReverification: () => ({
    data: dueData,
    isLoading: dueLoading,
    isError: dueError,
    refetch: dueRefetch,
  }),
}))

function envelope(data: unknown) {
  // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
  return { data: { data }, status: 200, headers: new Headers() } as any
}

function mountReverify(code = CODE) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return mount(AdminCertReverify, {
    props: { code },
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
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
  vi.mocked(certSetupControllerDiscoverSources).mockResolvedValue(
    envelope({
      candidates: [{ url: SOURCE_URL, title: 'AWS SAA', snippet: 'guide' }],
      suggestedContentSources: [],
    }),
  )
  vi.mocked(certSetupControllerExtract).mockResolvedValue(
    envelope({ jobId: 'job-1', state: 'active' }),
  )
  vi.mocked(certSetupControllerReadExtraction).mockResolvedValue(
    envelope({ state: 'completed', fields: EXTRACTION_FIELDS }),
  )
  vi.mocked(certSetupControllerReverify).mockResolvedValue(envelope(CURRENT_CERT))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AdminCertReverify', () => {
  it('renders the full-height stale screen with a breadcrumb, the cert title, and a stale pill', async () => {
    const wrapper = mountReverify()
    await flush()

    expect(wrapper.find('[data-testid="admin-cert-reverify-page"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="reverify-breadcrumb"]').text()).toContain(CODE)
    expect(wrapper.find('[data-testid="reverify-stale-pill"]').text()).toMatch(/stale/i)
    expect(wrapper.text()).toContain('AWS Certified Solutions Architect')

    wrapper.unmount()
  })

  it('runs the reverify chain automatically for the resolved cert and renders the colored diff', async () => {
    const wrapper = mountReverify()
    await flush()

    expect(certificationsControllerDetail).toHaveBeenCalledWith(CERT_ID)

    const changedRow = wrapper.find('[data-testid="reverify-diff-row-passingScore"]')
    expect(changedRow.exists()).toBe(true)
    expect(changedRow.attributes('data-changed')).toBe('true')

    const currentCell = changedRow.find('[data-testid="reverify-current-value"]')
    const proposedCell = changedRow.find('[data-testid="reverify-proposed-value"]')
    expect(currentCell.classes()).toContain('line-through')
    expect(proposedCell.classes().join(' ')).toMatch(/font-semibold|font-bold/)

    wrapper.unmount()
  })

  it('labels the diff columns "Current (outdated)" and "Proposed (new guide)"', async () => {
    const wrapper = mountReverify()
    await flush()

    expect(wrapper.find('[data-testid="reverify-col-current"]').text()).toContain('outdated')
    expect(wrapper.find('[data-testid="reverify-col-proposed"]').text()).toContain('new guide')
  })

  it('does not render the extraction-step "(unverified)" annotation', async () => {
    const wrapper = mountReverify()
    await flush()

    expect(wrapper.text()).not.toContain('(unverified)')
  })

  it('shows a not-found message when no due item matches the code', async () => {
    dueData.value = []
    const wrapper = mountReverify('UNKNOWN')
    await flush()

    expect(wrapper.find('[data-testid="reverify-not-found"]').exists()).toBe(true)
    expect(certificationsControllerDetail).not.toHaveBeenCalled()
  })

  it('does not flash not-found while the due-certification read is unresolved', async () => {
    dueData.value = []
    dueLoading.value = true
    const wrapper = mountReverify()
    await nextTick()

    expect(wrapper.find('[data-testid="reverify-due-loading"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="reverify-not-found"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows a retryable due-certification read failure without a false not-found state', async () => {
    dueData.value = []
    dueError.value = true
    const wrapper = mountReverify()
    await nextTick()

    expect(wrapper.find('[data-testid="reverify-due-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="reverify-not-found"]').exists()).toBe(false)

    await wrapper.find('[data-testid="admin-async-retry-btn"]').trigger('click')
    expect(dueRefetch).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('shows Re-verifying… and rejects duplicate submit while re-verification is pending', async () => {
    let resolveReverify: ((value: ReturnType<typeof envelope>) => void) | undefined
    vi.mocked(certSetupControllerReverify).mockReturnValue(
      new Promise((resolve) => {
        resolveReverify = resolve
      }) as never,
    )
    const wrapper = mountReverify()
    await flush()

    const submit = wrapper.find('[data-testid="reverify-submit-btn"]')
    await submit.trigger('click')
    await flushPromises()

    expect(certSetupControllerReverify).toHaveBeenCalledTimes(1)
    expect(submit.attributes('aria-busy')).toBe('true')
    expect(submit.text()).toContain('Re-verifying…')
    expect(submit.find('[data-testid="readion-button-spinner"]').exists()).toBe(true)

    await submit.trigger('click')
    expect(certSetupControllerReverify).toHaveBeenCalledTimes(1)

    resolveReverify?.(envelope(CURRENT_CERT))
    await flush()
    wrapper.unmount()
  })
})
