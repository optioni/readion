import type { DiscoverSourcesResponse } from '@readion/shared'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReadionProblemDetailsError } from '~/api/mutator'
import CertSetupWizard from '~/components/admin/CertSetupWizard.vue'
import {
  certSetupControllerDiscoverSources,
  certSetupControllerExtract,
} from '~~/src/api/cert-setup/cert-setup'

vi.mock('~~/src/api/cert-setup/cert-setup')

const CERT_NAME = 'AWS Certified Solutions Architect — Associate'
const CODE = 'SAA-C03'
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

afterEach(() => {
  vi.clearAllMocks()
})

function mountWizard() {
  return mount(CertSetupWizard)
}

async function fillAndDiscover(
  wrapper: VueWrapper,
  { name = CERT_NAME, code = CODE as string | null } = {},
) {
  await wrapper.find('[data-testid="discover-name-input"]').setValue(name)
  if (code) {
    await wrapper.find('[data-testid="discover-code-input"]').setValue(code)
  }
  await wrapper.find('[data-testid="discover-submit-btn"]').trigger('click')
  await flushPromises()
}

function lastBody(mock: ReturnType<typeof vi.mocked>): Record<string, unknown> {
  const options = mock.mock.calls.at(-1)?.[0] as { body: string }
  return JSON.parse(options.body)
}

describe('CertSetupWizard step 1 — discovery', () => {
  it('renders the page root and the discover form on step 1', () => {
    const wrapper = mountWizard()
    expect(wrapper.find('[data-testid="admin-cert-setup-page"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="discover-name-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="discover-code-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="discover-submit-btn"]').exists()).toBe(true)
  })

  it('triggers discoverSources with name and code, rendering selectable candidates without a confidence badge', async () => {
    mockDiscover()
    const wrapper = mountWizard()

    await fillAndDiscover(wrapper)

    expect(certSetupControllerDiscoverSources).toHaveBeenCalledTimes(1)
    expect(lastBody(vi.mocked(certSetupControllerDiscoverSources))).toEqual({
      name: CERT_NAME,
      code: CODE,
    })

    const candidates = wrapper.findAll('[data-testid="source-candidate"]')
    expect(candidates).toHaveLength(2)
    expect(candidates[0].attributes('data-url')).toBe(FIRST_URL)
    expect(candidates[1].attributes('data-url')).toBe(PDF_URL)
    expect(wrapper.find('[data-testid="source-confidence"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="manual-url-input"]').exists()).toBe(true)
  })

  it('omits the code field from the discover body when code is empty', async () => {
    mockDiscover()
    const wrapper = mountWizard()

    await fillAndDiscover(wrapper, { name: CERT_NAME, code: null })

    expect(lastBody(vi.mocked(certSetupControllerDiscoverSources))).toEqual({ name: CERT_NAME })
  })

  it('disables the discover button until a name is entered', async () => {
    const wrapper = mountWizard()
    expect(wrapper.find('[data-testid="discover-submit-btn"]').attributes('disabled')).toBeDefined()

    await wrapper.find('[data-testid="discover-name-input"]').setValue(CERT_NAME)
    expect(
      wrapper.find('[data-testid="discover-submit-btn"]').attributes('disabled'),
    ).toBeUndefined()
  })

  it('surfaces a problem-details error when discovery fails', async () => {
    vi.mocked(certSetupControllerDiscoverSources).mockRejectedValue(
      new ReadionProblemDetailsError({ title: 'Bad Request', status: 400, detail: 'No name' }),
    )
    const wrapper = mountWizard()

    await fillAndDiscover(wrapper)

    expect(wrapper.find('[data-testid="discover-error"]').text()).toContain('No name')
    expect(wrapper.findAll('[data-testid="source-candidate"]')).toHaveLength(0)
  })
})

describe('CertSetupWizard step 1 — confirm', () => {
  it('confirming a selected candidate triggers extraction with the selected url and advances to step 2', async () => {
    mockDiscover()
    mockExtract('extract-job-1')
    const wrapper = mountWizard()

    await fillAndDiscover(wrapper)
    await wrapper.findAll('[data-testid="source-candidate"]')[0].trigger('click')
    await wrapper.find('[data-testid="confirm-source-btn"]').trigger('click')
    await flushPromises()

    expect(certSetupControllerExtract).toHaveBeenCalledTimes(1)
    expect(lastBody(vi.mocked(certSetupControllerExtract))).toEqual({
      name: CERT_NAME,
      code: CODE,
      confirmedSourceUrl: FIRST_URL,
    })

    expect(wrapper.find('[data-testid="discover-submit-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cert-setup-step-placeholder"]').exists()).toBe(true)
  })

  it('confirms a manually pasted url over the candidate list', async () => {
    mockDiscover()
    mockExtract()
    const wrapper = mountWizard()

    await fillAndDiscover(wrapper)
    await wrapper.find('[data-testid="manual-url-input"]').setValue('https://example.com/guide')
    await wrapper.find('[data-testid="confirm-source-btn"]').trigger('click')
    await flushPromises()

    expect(lastBody(vi.mocked(certSetupControllerExtract))).toMatchObject({
      confirmedSourceUrl: 'https://example.com/guide',
    })
  })

  it('gates confirm on a valid url: disabled with no selection and with an invalid manual url', async () => {
    mockDiscover()
    const wrapper = mountWizard()

    await fillAndDiscover(wrapper)
    expect(wrapper.find('[data-testid="confirm-source-btn"]').attributes('disabled')).toBeDefined()

    await wrapper.find('[data-testid="manual-url-input"]').setValue('not-a-url')
    expect(wrapper.find('[data-testid="confirm-source-btn"]').attributes('disabled')).toBeDefined()

    await wrapper.findAll('[data-testid="source-candidate"]')[0].trigger('click')
    await wrapper.find('[data-testid="manual-url-input"]').setValue('')
    expect(
      wrapper.find('[data-testid="confirm-source-btn"]').attributes('disabled'),
    ).toBeUndefined()
  })
})
