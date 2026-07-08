import type { ContentSourceResponse, IngestionJobStatus } from '@readion/shared'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { ReadionProblemDetailsError } from '~/api/mutator'
import AdminSources from '~/components/admin/AdminSources.vue'
import { adminQueryKeys } from '~/composables/adminQueryKeys'
import { useAdminSources, useSourceJobs } from '~/composables/useAdminSources'
import { certificationsControllerList } from '~~/src/api/certifications/certifications'
import {
  contentControllerDisable,
  contentControllerEnable,
  contentControllerRegister,
  contentControllerReingest,
} from '~~/src/api/content/content'

vi.mock('~/composables/useAdminSources', () => ({
  useAdminSources: vi.fn(),
  useSourceJobs: vi.fn(),
}))
vi.mock('~~/src/api/content/content')
vi.mock('~~/src/api/certifications/certifications')

const CERT_ID = 'c0000000-0000-0000-0000-000000000001'
const OTHER_CERT_ID = 'c0000000-0000-0000-0000-000000000002'
const ENABLED_ID = 'd0000000-0000-0000-0000-000000000001'
const DISABLED_ID = 'd0000000-0000-0000-0000-000000000002'

const CERTS = [
  {
    id: CERT_ID,
    name: 'AWS Certified Solutions Architect',
    provider: 'AWS',
    code: 'SAA-C03',
    domains: [],
    questionCount: 65,
    passingScore: 72,
    timeLimitMinutes: 130,
    state: 'live',
  },
  {
    id: OTHER_CERT_ID,
    name: 'Azure Fundamentals',
    provider: 'Microsoft',
    code: 'AZ-900',
    domains: [],
    questionCount: 40,
    passingScore: 700,
    timeLimitMinutes: 60,
    state: 'published',
  },
]

const SOURCES: ContentSourceResponse[] = [
  {
    id: ENABLED_ID,
    certificationId: CERT_ID,
    type: 'web',
    url: 'https://docs.aws.amazon.com/',
    enabled: true,
    lastFetchedAt: '2026-06-25T08:00:00.000Z',
    recheckIntervalMinutes: 10080,
    createdAt: '2026-01-01T00:00:00.000Z',
    chunkCount: 142,
  },
  {
    id: DISABLED_ID,
    certificationId: CERT_ID,
    type: 'rss',
    url: 'https://example.com/feed.xml',
    enabled: false,
    lastFetchedAt: null,
    recheckIntervalMinutes: 1440,
    createdAt: '2026-01-02T00:00:00.000Z',
    chunkCount: 0,
    // biome-ignore lint/suspicious/noExplicitAny: the API may return a source type outside the shared enum
  } as any as ContentSourceResponse,
]

function job(overrides: Partial<IngestionJobStatus> = {}): IngestionJobStatus {
  return {
    jobId: 'j1',
    state: 'completed',
    progress: 100,
    attemptsMade: 1,
    failedReason: null,
    timestamp: 1,
    processedOn: 1,
    finishedOn: 1,
    ...overrides,
  }
}

function stubSources(
  sources: ContentSourceResponse[] = SOURCES,
  options: { isLoading?: boolean; isError?: boolean } = {},
) {
  vi.mocked(useAdminSources).mockReturnValue({
    data: computed(() => sources),
    isLoading: computed(() => options.isLoading ?? false),
    isError: computed(() => options.isError ?? false),
    refetch: vi.fn(),
    // biome-ignore lint/suspicious/noExplicitAny: vue-query return shape narrowed in tests
  } as any)
}

function stubJobs(jobsBySource: Record<string, IngestionJobStatus[]> = {}) {
  vi.mocked(useSourceJobs).mockReturnValue({
    data: computed(() => jobsBySource),
    isLoading: computed(() => false),
    isError: computed(() => false),
    refetch: vi.fn(),
    // biome-ignore lint/suspicious/noExplicitAny: vue-query return shape narrowed in tests
  } as any)
}

function mountWithQuery(query: Record<string, string>) {
  vi.stubGlobal('useRoute', () => ({ query }))
  const replace = vi.fn()
  vi.stubGlobal('useRouter', () => ({ replace }))
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  const wrapper = mount(AdminSources, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  return { wrapper, invalidateSpy, replace }
}

function mountSources() {
  return mountWithQuery({ certificationId: CERT_ID })
}

function rowFor(wrapper: ReturnType<typeof mountSources>['wrapper'], id: string) {
  return wrapper.find(`[data-testid="source-row"][data-source-id="${id}"]`)
}

async function openAddSourceForm(wrapper: ReturnType<typeof mountSources>['wrapper']) {
  await wrapper.find('[data-testid="add-source-toggle"]').trigger('click')
}

const created = (source: ContentSourceResponse) => ({
  data: { data: source },
  status: 201,
  headers: new Headers(),
})

beforeEach(() => {
  vi.mocked(certificationsControllerList).mockResolvedValue({
    data: { data: CERTS, meta: { total: CERTS.length, page: 1, limit: 20 } },
    status: 200,
    headers: new Headers(),
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
  } as any)
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('AdminSources render', () => {
  it('renders the page root and a row per source with url and type', () => {
    stubSources()
    stubJobs()
    const { wrapper } = mountSources()

    expect(wrapper.find('[data-testid="admin-sources-page"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="source-row"]')).toHaveLength(2)

    const enabledRow = rowFor(wrapper, ENABLED_ID)
    expect(enabledRow.text()).toContain('https://docs.aws.amazon.com/')
    expect(enabledRow.text()).toContain('web')
  })

  it('renders the API-provided type string even when outside the shared enum', () => {
    stubSources()
    stubJobs()
    const { wrapper } = mountSources()

    expect(rowFor(wrapper, DISABLED_ID).text()).toContain('rss')
  })

  it('derives an active pill for an enabled source with a completed job', () => {
    stubSources()
    stubJobs({ [ENABLED_ID]: [job({ state: 'completed' })] })
    const { wrapper } = mountSources()

    expect(rowFor(wrapper, ENABLED_ID).find('[data-testid="source-status-pill"]').text()).toContain(
      'Active',
    )
  })

  it('derives a disabled pill for a disabled source', () => {
    stubSources()
    stubJobs()
    const { wrapper } = mountSources()

    expect(
      rowFor(wrapper, DISABLED_ID).find('[data-testid="source-status-pill"]').text(),
    ).toContain('Disabled')
  })

  it('shows an ingesting pill and the running-jobs banner when a job is in flight', () => {
    stubSources()
    stubJobs({ [ENABLED_ID]: [job({ state: 'active' })] })
    const { wrapper } = mountSources()

    expect(rowFor(wrapper, ENABLED_ID).find('[data-testid="source-status-pill"]').text()).toContain(
      'Ingesting',
    )
    expect(wrapper.find('[data-testid="source-jobs-banner"]').exists()).toBe(true)
  })

  it('hides the running-jobs banner when nothing is in flight', () => {
    stubSources()
    stubJobs({ [ENABLED_ID]: [job({ state: 'completed' })] })
    const { wrapper } = mountSources()

    expect(wrapper.find('[data-testid="source-jobs-banner"]').exists()).toBe(false)
  })

  it('renders chunk counts and last-ingested dates from the contract, with no cancel or upload controls', () => {
    stubSources()
    stubJobs()
    const { wrapper } = mountSources()

    expect(rowFor(wrapper, ENABLED_ID).find('[data-testid="source-chunk-count"]').text()).toBe(
      '142',
    )
    expect(rowFor(wrapper, DISABLED_ID).find('[data-testid="source-chunk-count"]').text()).toBe(
      '0',
    )
    expect(
      rowFor(wrapper, ENABLED_ID).find('[data-testid="source-last-ingested"]').text(),
    ).toContain('Jun 25, 2026')
    expect(
      rowFor(wrapper, DISABLED_ID).find('[data-testid="source-last-ingested"]').text(),
    ).not.toBe('')

    expect(wrapper.find('[data-testid="source-cancel-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="source-upload-input"]').exists()).toBe(false)
  })

  it('falls back to the latest completed job for last-ingested when lastFetchedAt is null', () => {
    stubSources()
    stubJobs({ [DISABLED_ID]: [job({ state: 'completed', finishedOn: 1751000000000 })] })
    const { wrapper } = mountSources()

    const cell = rowFor(wrapper, DISABLED_ID).find('[data-testid="source-last-ingested"]')
    expect(cell.text()).not.toBe('')
    expect(cell.text().toLowerCase()).not.toContain('never')
  })

  it('shows a placeholder for last-ingested when there is no fetch date and no completed job', () => {
    stubSources()
    stubJobs()
    const { wrapper } = mountSources()

    expect(
      rowFor(wrapper, DISABLED_ID).find('[data-testid="source-last-ingested"]').text().length,
    ).toBeGreaterThan(0)
  })

  it('shows loading and error states', () => {
    stubSources([], { isLoading: true })
    stubJobs()
    const loading = mountSources()
    expect(loading.wrapper.find('[data-testid="admin-sources-loading"]').exists()).toBe(true)

    vi.clearAllMocks()
    stubSources([], { isError: true })
    stubJobs()
    const errored = mountSources()
    expect(errored.wrapper.find('[data-testid="admin-sources-error"]').exists()).toBe(true)
  })
})

describe('AdminSources empty state', () => {
  it('renders an empty state instead of the table when no certification is selected', async () => {
    stubSources([])
    stubJobs()
    const { wrapper } = mountWithQuery({})
    await flushPromises()

    const empty = wrapper.find('[data-testid="sources-empty-state"]')
    expect(empty.exists()).toBe(true)
    expect(empty.text()).toContain('Select a certification to view its sources')
    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.find('thead').exists()).toBe(false)
  })

  it('still renders the certification pills when no certification is selected', async () => {
    stubSources([])
    stubJobs()
    const { wrapper } = mountWithQuery({})
    await flushPromises()

    expect(wrapper.findAll('[data-testid="source-cert-pill"]')).toHaveLength(2)
  })
})

describe('AdminSources certification pills', () => {
  it('renders one pill per certification with the active one marked', async () => {
    stubSources()
    stubJobs()
    const { wrapper } = mountSources()
    await flushPromises()

    const pills = wrapper.findAll('[data-testid="source-cert-pill"]')
    expect(pills).toHaveLength(2)

    const activePill = wrapper.find('[data-testid="source-cert-pill"][data-cert-id="' + CERT_ID + '"]')
    expect(activePill.attributes('aria-pressed')).toBe('true')

    const inactivePill = wrapper.find(
      '[data-testid="source-cert-pill"][data-cert-id="' + OTHER_CERT_ID + '"]',
    )
    expect(inactivePill.attributes('aria-pressed')).toBe('false')
  })

  it('does not render a select element for certification choice', () => {
    stubSources()
    stubJobs()
    const { wrapper } = mountSources()

    expect(wrapper.find('[data-testid="source-cert-select"]').exists()).toBe(false)
  })

  it('writes the chosen certification back to the route query when a pill is clicked', async () => {
    stubSources()
    stubJobs()
    const { wrapper, replace } = mountSources()
    await flushPromises()

    await wrapper
      .find('[data-testid="source-cert-pill"][data-cert-id="' + OTHER_CERT_ID + '"]')
      .trigger('click')

    expect(replace).toHaveBeenCalledWith({
      query: { certificationId: OTHER_CERT_ID },
    })
  })
})

describe('AdminSources add-source affordance', () => {
  it('hides the registration form until the dashed affordance is activated', () => {
    stubSources()
    stubJobs()
    const { wrapper } = mountSources()

    expect(wrapper.find('[data-testid="add-source-toggle"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="register-source-url-input"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="add-source-form"]').exists()).toBe(false)
  })

  it('reveals the registration form once the affordance is activated', async () => {
    stubSources()
    stubJobs()
    const { wrapper } = mountSources()

    await openAddSourceForm(wrapper)

    expect(wrapper.find('[data-testid="add-source-form"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="register-source-url-input"]').exists()).toBe(true)
  })
})

describe('AdminSources register', () => {
  it('registers a source by url for the active certification and invalidates the list', async () => {
    stubSources()
    stubJobs()
    vi.mocked(contentControllerRegister).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      created(SOURCES[0] as ContentSourceResponse) as any,
    )
    const { wrapper, invalidateSpy } = mountSources()
    await openAddSourceForm(wrapper)

    await wrapper
      .find('[data-testid="register-source-url-input"]')
      .setValue('https://example.com/study-guide')
    await wrapper.find('[data-testid="register-source-type-select"]').setValue('web')
    await wrapper.find('[data-testid="register-source-submit"]').trigger('submit')
    await flushPromises()

    expect(contentControllerRegister).toHaveBeenCalledTimes(1)
    const body = JSON.parse(vi.mocked(contentControllerRegister).mock.calls[0]?.[0]?.body as string)
    expect(body).toEqual({
      certificationId: CERT_ID,
      type: 'web',
      url: 'https://example.com/study-guide',
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: adminQueryKeys.contentSources(CERT_ID),
    })
  })

  it('rejects an invalid url without calling the API', async () => {
    stubSources()
    stubJobs()
    const { wrapper } = mountSources()
    await openAddSourceForm(wrapper)

    await wrapper.find('[data-testid="register-source-url-input"]').setValue('not-a-url')
    await wrapper.find('[data-testid="register-source-submit"]').trigger('submit')
    await flushPromises()

    expect(contentControllerRegister).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="register-source-error"]').exists()).toBe(true)
  })

  it('surfaces a problem-details error from the register call', async () => {
    stubSources()
    stubJobs()
    vi.mocked(contentControllerRegister).mockRejectedValue(
      new ReadionProblemDetailsError({
        title: 'Bad Request',
        status: 400,
        detail: 'Already exists.',
      }),
    )
    const { wrapper } = mountSources()
    await openAddSourceForm(wrapper)

    await wrapper
      .find('[data-testid="register-source-url-input"]')
      .setValue('https://example.com/dup')
    await wrapper.find('[data-testid="register-source-submit"]').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[data-testid="register-source-error"]').text()).toContain(
      'Already exists.',
    )
  })
})

describe('AdminSources row actions', () => {
  it('re-ingests a source by id and invalidates list and jobs', async () => {
    stubSources()
    stubJobs()
    vi.mocked(contentControllerReingest).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      { data: { jobId: 'j2' }, status: 202, headers: new Headers() } as any,
    )
    const { wrapper, invalidateSpy } = mountSources()

    await rowFor(wrapper, ENABLED_ID).find('[data-testid="source-reingest-btn"]').trigger('click')
    await flushPromises()

    expect(contentControllerReingest).toHaveBeenCalledWith(ENABLED_ID, expect.anything())
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: adminQueryKeys.contentSources(CERT_ID),
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: adminQueryKeys.sourceJobs(CERT_ID),
    })
  })

  it('removes a source via disable by id and invalidates the list', async () => {
    stubSources()
    stubJobs()
    vi.mocked(contentControllerDisable).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      created(SOURCES[0] as ContentSourceResponse) as any,
    )
    const { wrapper, invalidateSpy } = mountSources()

    await rowFor(wrapper, ENABLED_ID).find('[data-testid="source-disable-btn"]').trigger('click')
    await flushPromises()

    expect(contentControllerDisable).toHaveBeenCalledWith(ENABLED_ID, expect.anything())
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: adminQueryKeys.contentSources(CERT_ID),
    })
  })

  it('reflects the enabled field via the Enabled toggle', () => {
    stubSources()
    stubJobs()
    const { wrapper } = mountSources()

    expect(
      rowFor(wrapper, ENABLED_ID).find('[data-testid="source-enabled-toggle"]').attributes(
        'aria-checked',
      ),
    ).toBe('true')
    expect(
      rowFor(wrapper, DISABLED_ID).find('[data-testid="source-enabled-toggle"]').attributes(
        'aria-checked',
      ),
    ).toBe('false')
  })

  it('disables an enabled source when its Enabled toggle is switched off', async () => {
    stubSources()
    stubJobs()
    vi.mocked(contentControllerDisable).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      created(SOURCES[0] as ContentSourceResponse) as any,
    )
    const { wrapper } = mountSources()

    await rowFor(wrapper, ENABLED_ID)
      .find('[data-testid="source-enabled-toggle"]')
      .trigger('click')
    await flushPromises()

    expect(contentControllerDisable).toHaveBeenCalledWith(ENABLED_ID, expect.anything())
    expect(contentControllerEnable).not.toHaveBeenCalled()
  })

  it('enables a disabled source when its Enabled toggle is switched on', async () => {
    stubSources()
    stubJobs()
    vi.mocked(contentControllerEnable).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      created(SOURCES[1] as ContentSourceResponse) as any,
    )
    const { wrapper } = mountSources()

    await rowFor(wrapper, DISABLED_ID)
      .find('[data-testid="source-enabled-toggle"]')
      .trigger('click')
    await flushPromises()

    expect(contentControllerEnable).toHaveBeenCalledWith(DISABLED_ID, expect.anything())
    expect(contentControllerDisable).not.toHaveBeenCalled()
  })
})
