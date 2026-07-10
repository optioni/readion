import type { DiscoverSourcesResponse } from '@readion/shared'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReadionProblemDetailsError } from '~/api/mutator'
import CertSetupWizard from '~/components/admin/CertSetupWizard.vue'
import {
  certSetupControllerCreate,
  certSetupControllerDiscoverSources,
  certSetupControllerExtract,
  certSetupControllerReadExtraction,
} from '~~/src/api/cert-setup/cert-setup'
import { certificationCoverageControllerCoverage } from '~~/src/api/certification-coverage/certification-coverage'

vi.mock('~~/src/api/cert-setup/cert-setup')
vi.mock('~~/src/api/certification-coverage/certification-coverage')

const CERT_NAME = 'AWS Certified Solutions Architect — Associate'
const CODE = 'SAA-C03'
const PROVIDER = 'Amazon Web Services'
const FIRST_URL = 'https://aws.amazon.com/certification/certified-solutions-architect-associate/'
const PDF_URL = 'https://d1.awsstatic.com/SAA-C03-exam-guide.pdf'

const DISCOVER_RESPONSE: DiscoverSourcesResponse = {
  candidates: [
    { url: FIRST_URL, title: 'AWS Certification — SAA', snippet: 'Official certification page.' },
    { url: PDF_URL, title: 'SAA-C03 Exam Guide (PDF)', snippet: 'Exam guide PDF.' },
  ],
  suggestedContentSources: [],
}

function mockDiscover(response: DiscoverSourcesResponse = DISCOVER_RESPONSE) {
  vi.mocked(certSetupControllerDiscoverSources).mockResolvedValue(
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
    { data: { data: response }, status: 200, headers: new Headers() } as any,
  )
}

function mockExtract(jobId = 'extract-job-1') {
  vi.mocked(certSetupControllerExtract).mockResolvedValue(
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
    { data: { data: { jobId, state: 'active' } }, status: 202, headers: new Headers() } as any,
  )
}

beforeEach(() => {
  // Step 3 (extraction step) polls this on mount; default to an in-flight job so the
  // poll stays pending while earlier-step assertions run.
  vi.mocked(certSetupControllerReadExtraction).mockResolvedValue(
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
    {
      data: { data: { state: 'active', fields: null } },
      status: 200,
      headers: new Headers(),
    } as any,
  )
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

function mountWizard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return mount(CertSetupWizard, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
}

async function fillIdentifyAndSearch(
  wrapper: VueWrapper,
  { name = CERT_NAME, code = CODE as string, provider = PROVIDER, knownUrl = '' } = {},
) {
  await wrapper.find('[data-testid="identify-name-input"]').setValue(name)
  await wrapper.find('[data-testid="identify-code-input"]').setValue(code)
  await wrapper.find('[data-testid="identify-provider-input"]').setValue(provider)
  if (knownUrl) {
    await wrapper.find('[data-testid="identify-known-url-input"]').setValue(knownUrl)
  }
  await wrapper.find('[data-testid="identify-search-btn"]').trigger('click')
  await flushPromises()
}

async function advanceToExtraction(wrapper: VueWrapper) {
  await fillIdentifyAndSearch(wrapper)
  await wrapper.findAll('[data-testid="source-candidate"]')[0]!.trigger('click')
  await wrapper.find('[data-testid="confirm-source-btn"]').trigger('click')
  await flushPromises()
}

function lastBody(
  fn: typeof certSetupControllerDiscoverSources | typeof certSetupControllerExtract,
): Record<string, unknown> {
  const options = vi.mocked(fn).mock.calls.at(-1)?.[0] as { body: string }
  return JSON.parse(options.body)
}

describe('CertSetupWizard step 1 — identify', () => {
  it('renders the page root and the standalone identify screen (not the discovery form)', () => {
    const wrapper = mountWizard()
    expect(wrapper.find('[data-testid="admin-cert-setup-page"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cert-identify-step"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="identify-name-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="identify-code-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="identify-provider-input"]').exists()).toBe(true)
  })

  it('kicks off discovery on "Search for sources →" and advances to the confirmation step', async () => {
    mockDiscover()
    const wrapper = mountWizard()

    await fillIdentifyAndSearch(wrapper)

    expect(certSetupControllerDiscoverSources).toHaveBeenCalledTimes(1)
    expect(lastBody(certSetupControllerDiscoverSources)).toEqual({ name: CERT_NAME, code: CODE })

    expect(wrapper.find('[data-testid="cert-identify-step"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cert-confirm-step"]').exists()).toBe(true)
    const candidates = wrapper.findAll('[data-testid="source-candidate"]')
    expect(candidates).toHaveLength(2)
    expect(candidates[0]!.attributes('data-url')).toBe(FIRST_URL)
  })

  it('surfaces a problem-details error when discovery fails and stays on the identify step', async () => {
    vi.mocked(certSetupControllerDiscoverSources).mockRejectedValue(
      new ReadionProblemDetailsError({ title: 'Bad Request', status: 400, detail: 'No name' }),
    )
    const wrapper = mountWizard()

    await fillIdentifyAndSearch(wrapper)

    expect(wrapper.find('[data-testid="identify-error"]').text()).toContain('No name')
    expect(wrapper.find('[data-testid="cert-identify-step"]').exists()).toBe(true)
  })
})

describe('CertSetupWizard step 2 — confirm', () => {
  it('confirming a selected candidate triggers extraction with the selected url and advances to step 3', async () => {
    mockDiscover()
    mockExtract('extract-job-1')
    const wrapper = mountWizard()

    await advanceToExtraction(wrapper)

    expect(certSetupControllerExtract).toHaveBeenCalledTimes(1)
    expect(lastBody(certSetupControllerExtract)).toEqual({
      name: CERT_NAME,
      code: CODE,
      confirmedSourceUrl: FIRST_URL,
    })

    expect(wrapper.find('[data-testid="cert-confirm-step"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cert-extraction-step"]').exists()).toBe(true)
  })

  it('confirms a manually pasted url over the candidate list', async () => {
    mockDiscover()
    mockExtract()
    const wrapper = mountWizard()

    await fillIdentifyAndSearch(wrapper)
    await wrapper.find('[data-testid="manual-url-input"]').setValue('https://example.com/guide')
    await wrapper.find('[data-testid="confirm-source-btn"]').trigger('click')
    await flushPromises()

    expect(lastBody(certSetupControllerExtract)).toMatchObject({
      confirmedSourceUrl: 'https://example.com/guide',
    })
  })

  it('prefills the manual URL from the upfront known-URL entered at step 1', async () => {
    mockDiscover()
    const wrapper = mountWizard()

    await fillIdentifyAndSearch(wrapper, { knownUrl: 'https://known.example.com/guide' })

    expect(
      (wrapper.find('[data-testid="manual-url-input"]').element as HTMLInputElement).value,
    ).toBe('https://known.example.com/guide')
  })
})

describe('CertSetupWizard step 3→4 — submit draft + coverage', () => {
  const GROUNDED_FIELDS = {
    domains: {
      value: [
        { name: 'Secure', weight: 30 },
        { name: 'Resilient', weight: 26 },
        { name: 'High-Performing', weight: 24 },
        { name: 'Cost-Optimized', weight: 20 },
      ],
      citation: { url: PDF_URL, passage: 'Four domains' },
    },
    questionCount: { unverified: true },
    passingScore: { value: 67, citation: { url: FIRST_URL, passage: '720/1000' } },
    timeLimitMinutes: { value: 130, citation: { url: FIRST_URL, passage: '130 minutes' } },
  }

  const COVERAGE_REPORT = {
    domains: [
      { name: 'Secure', chunkCount: 10, chunkThreshold: 20, enabledSourceCount: 1, met: false },
    ],
    totalChunks: 10,
    totalThreshold: 20,
    state: 'draft',
    met: false,
  }

  function envelope(payload: unknown, status: number) {
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
    return { data: { data: payload }, status, headers: new Headers() } as any
  }

  it('carries the step-1 identity into the extraction step, creates a draft, and reveals read-only coverage', async () => {
    mockDiscover()
    mockExtract()
    vi.mocked(certSetupControllerReadExtraction).mockResolvedValue(
      envelope({ state: 'completed', fields: GROUNDED_FIELDS }, 200),
    )
    vi.mocked(certSetupControllerCreate).mockResolvedValue(
      envelope({ id: 'c0000000-0000-0000-0000-000000000002', state: 'draft' }, 201),
    )
    vi.mocked(certificationCoverageControllerCoverage).mockResolvedValue(
      envelope(COVERAGE_REPORT, 200),
    )

    const wrapper = mountWizard()
    await advanceToExtraction(wrapper)

    // Identity fields arrive pre-filled from step 1 — no re-entry needed.
    expect((wrapper.find('[data-testid="cert-name-input"]').element as HTMLInputElement).value).toBe(
      CERT_NAME,
    )
    expect(
      (wrapper.find('[data-testid="cert-provider-input"]').element as HTMLInputElement).value,
    ).toBe(PROVIDER)
    expect((wrapper.find('[data-testid="cert-code-input"]').element as HTMLInputElement).value).toBe(
      CODE,
    )

    expect(wrapper.find('[data-testid="publish-cert-btn"]').exists()).toBe(false)
    await wrapper.find('[data-testid="submit-draft-btn"]').trigger('click')
    await flushPromises()

    expect(certSetupControllerCreate).toHaveBeenCalledTimes(1)
    const body = JSON.parse(vi.mocked(certSetupControllerCreate).mock.calls[0]?.[0]?.body as string)
    expect(body).toMatchObject({ name: CERT_NAME, provider: PROVIDER, code: CODE })

    expect(wrapper.find('[data-testid="cert-coverage"]').exists()).toBe(true)
    expect(certificationCoverageControllerCoverage).toHaveBeenCalledWith(
      'c0000000-0000-0000-0000-000000000002',
    )
  })
})

describe('CertSetupWizard — SetupHeader chrome', () => {
  function envelopeFor(payload: unknown, status = 200) {
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
    return { data: { data: payload }, status, headers: new Headers() } as any
  }

  it('renders the SetupHeader at step 1 of 5 alongside the identify screen', () => {
    const wrapper = mountWizard()

    expect(wrapper.find('[data-testid="setup-header"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="setup-header-step-indicator"]').text()).toBe(
      'Step 1 of 5 · Identify certification',
    )
    expect(wrapper.find('[data-testid="cert-identify-step"]').exists()).toBe(true)
  })

  it('advances the SetupHeader to step 2 of 5 on the confirmation screen', async () => {
    mockDiscover()
    const wrapper = mountWizard()

    await fillIdentifyAndSearch(wrapper)

    expect(wrapper.find('[data-testid="setup-header-step-indicator"]').text()).toBe(
      'Step 2 of 5 · Source confirmation',
    )
  })

  it('advances the SetupHeader to step 3 of 5 when the wizard moves to extraction', async () => {
    mockDiscover()
    mockExtract('extract-job-1')
    const wrapper = mountWizard()

    await advanceToExtraction(wrapper)

    expect(wrapper.find('[data-testid="setup-header-step-indicator"]').text()).toBe(
      'Step 3 of 5 · Field extraction',
    )
    expect(wrapper.find('[data-testid="cert-extraction-step"]').exists()).toBe(true)
  })

  it('advances the SetupHeader to step 4 of 5 alongside coverage once a draft is created', async () => {
    mockDiscover()
    mockExtract()
    vi.mocked(certSetupControllerReadExtraction).mockResolvedValue(
      envelopeFor({
        state: 'completed',
        fields: {
          domains: {
            value: [
              { name: 'Secure', weight: 30 },
              { name: 'Resilient', weight: 26 },
              { name: 'High-Performing', weight: 24 },
              { name: 'Cost-Optimized', weight: 20 },
            ],
            citation: { url: PDF_URL, passage: 'Four domains' },
          },
          questionCount: { unverified: true },
          passingScore: { unverified: true },
          timeLimitMinutes: { unverified: true },
        },
      }),
    )
    vi.mocked(certSetupControllerCreate).mockResolvedValue(
      envelopeFor({ id: 'c0000000-0000-0000-0000-000000000003', state: 'draft' }, 201),
    )
    vi.mocked(certificationCoverageControllerCoverage).mockResolvedValue(
      envelopeFor({ domains: [], totalChunks: 0, totalThreshold: 0, state: 'draft', met: false }),
    )

    const wrapper = mountWizard()
    await advanceToExtraction(wrapper)
    await wrapper.find('[data-testid="submit-draft-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="setup-header-step-indicator"]').text()).toBe(
      'Step 4 of 5 · Content sources',
    )
    expect(wrapper.find('[data-testid="cert-coverage"]').exists()).toBe(true)
  })

  it('activating Cancel navigates to the certifications landing without creating a draft', async () => {
    const navigateTo = vi.fn()
    vi.stubGlobal('navigateTo', navigateTo)
    const wrapper = mountWizard()

    await wrapper.find('[data-testid="setup-header-cancel"]').trigger('click')

    expect(navigateTo).toHaveBeenCalledWith('/admin/certifications')
    expect(certSetupControllerDiscoverSources).not.toHaveBeenCalled()
    expect(certSetupControllerExtract).not.toHaveBeenCalled()
    expect(certSetupControllerCreate).not.toHaveBeenCalled()
  })
})
