import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import OnboardingCertSelect from '~/components/OnboardingCertSelect.vue'
import { certificationsControllerList } from '~~/src/api/certifications/certifications'

vi.mock('~~/src/api/certifications/certifications')

const certification = (overrides: { id: string; name: string; provider?: string }) => ({
  id: overrides.id,
  name: overrides.name,
  provider: overrides.provider ?? 'AWS',
  code: 'SAA-C03',
  domains: [],
  questionCount: 65,
  passingScore: 720,
  timeLimitMinutes: 130,
  state: 'ready',
})

const okEnvelope = <T>(rows: T[]) => ({
  data: { data: rows, meta: { total: rows.length } },
  status: 200,
  headers: new Headers(),
})

function stubCertifications(rows: ReturnType<typeof certification>[]) {
  vi.mocked(certificationsControllerList).mockResolvedValue(
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
    okEnvelope(rows) as any,
  )
}

function mountStep() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const wrapper = mount(OnboardingCertSelect, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  return { wrapper, queryClient }
}

const continueButton = (wrapper: ReturnType<typeof mountStep>['wrapper']) =>
  wrapper.findAll('button').find((button) => /continue/i.test(button.text()))

afterEach(() => {
  vi.clearAllMocks()
})

describe('OnboardingCertSelect options', () => {
  it('renders one option per certification with name and provider', async () => {
    stubCertifications([
      certification({ id: 'cert-1', name: 'AWS Solutions Architect' }),
      certification({ id: 'cert-2', name: 'Azure Fundamentals', provider: 'Azure' }),
    ])

    const { wrapper } = mountStep()
    await flushPromises()

    const optionEls = wrapper.findAll('[data-testid="cert-option"]')
    expect(optionEls).toHaveLength(2)
    expect(optionEls[0]?.text()).toContain('AWS Solutions Architect')
    expect(optionEls[0]?.text()).toContain('AWS')
    expect(optionEls[1]?.text()).toContain('Azure Fundamentals')
    expect(optionEls[1]?.text()).toContain('Azure')
  })

  it('renders every certification the API returns when the search query is empty', async () => {
    stubCertifications([
      certification({ id: 'cert-1', name: 'AWS SA' }),
      certification({ id: 'cert-2', name: 'Azure Fundamentals', provider: 'Azure' }),
      certification({ id: 'cert-3', name: 'CKA', provider: 'CNCF' }),
    ])

    const { wrapper } = mountStep()
    await flushPromises()

    expect(wrapper.findAll('[data-testid="cert-option"]')).toHaveLength(3)
  })

  it('does not crash on an empty certification list', async () => {
    stubCertifications([])

    const { wrapper } = mountStep()
    await flushPromises()

    expect(wrapper.findAll('[data-testid="cert-option"]')).toHaveLength(0)
    expect(continueButton(wrapper)?.attributes('disabled')).toBeDefined()
  })
})

describe('OnboardingCertSelect search', () => {
  const searchInput = (wrapper: ReturnType<typeof mountStep>['wrapper']) =>
    wrapper.find('[data-testid="cert-search-input"]')

  it('renders a search input above the option list', async () => {
    stubCertifications([certification({ id: 'cert-1', name: 'AWS SA' })])

    const { wrapper } = mountStep()
    await flushPromises()

    const input = searchInput(wrapper)
    expect(input.exists()).toBe(true)
    expect(input.attributes('placeholder')).toMatch(/search certifications/i)
  })

  it('filters options by name as the query is typed', async () => {
    stubCertifications([
      certification({ id: 'cert-1', name: 'AWS Solutions Architect' }),
      certification({ id: 'cert-2', name: 'Azure Fundamentals', provider: 'Azure' }),
      certification({ id: 'cert-3', name: 'CKA', provider: 'CNCF' }),
    ])

    const { wrapper } = mountStep()
    await flushPromises()

    await searchInput(wrapper).setValue('azure')
    await flushPromises()

    const optionEls = wrapper.findAll('[data-testid="cert-option"]')
    expect(optionEls).toHaveLength(1)
    expect(optionEls[0]?.text()).toContain('Azure Fundamentals')
  })

  it('matches on provider and code, case-insensitively', async () => {
    stubCertifications([
      certification({ id: 'cert-1', name: 'AWS Solutions Architect' }),
      certification({ id: 'cert-2', name: 'Azure Fundamentals', provider: 'Azure' }),
      certification({ id: 'cert-3', name: 'Kubernetes Admin', provider: 'CNCF' }),
    ])

    const { wrapper } = mountStep()
    await flushPromises()

    await searchInput(wrapper).setValue('cncf')
    await flushPromises()
    expect(wrapper.findAll('[data-testid="cert-option"]')).toHaveLength(1)

    await searchInput(wrapper).setValue('saa-c03')
    await flushPromises()
    expect(wrapper.findAll('[data-testid="cert-option"]')).toHaveLength(3)
  })

  it('renders no options for a non-matching query', async () => {
    stubCertifications([
      certification({ id: 'cert-1', name: 'AWS SA' }),
      certification({ id: 'cert-2', name: 'Azure Fundamentals', provider: 'Azure' }),
    ])

    const { wrapper } = mountStep()
    await flushPromises()

    await searchInput(wrapper).setValue('zzz-no-such-certification')
    await flushPromises()

    expect(wrapper.findAll('[data-testid="cert-option"]')).toHaveLength(0)
  })

  it('restores the full list when the query is cleared', async () => {
    stubCertifications([
      certification({ id: 'cert-1', name: 'AWS SA' }),
      certification({ id: 'cert-2', name: 'Azure Fundamentals', provider: 'Azure' }),
    ])

    const { wrapper } = mountStep()
    await flushPromises()

    await searchInput(wrapper).setValue('zzz')
    await flushPromises()
    expect(wrapper.findAll('[data-testid="cert-option"]')).toHaveLength(0)

    await searchInput(wrapper).setValue('')
    await flushPromises()
    expect(wrapper.findAll('[data-testid="cert-option"]')).toHaveLength(2)
  })

  it('does not refetch the catalog while filtering', async () => {
    stubCertifications([
      certification({ id: 'cert-1', name: 'AWS SA' }),
      certification({ id: 'cert-2', name: 'Azure Fundamentals', provider: 'Azure' }),
    ])

    const { wrapper } = mountStep()
    await flushPromises()

    await searchInput(wrapper).setValue('aws')
    await flushPromises()
    await searchInput(wrapper).setValue('')
    await flushPromises()

    expect(certificationsControllerList).toHaveBeenCalledTimes(1)
  })
})

describe('OnboardingCertSelect selection', () => {
  it('disables Continue until a certification is selected', async () => {
    stubCertifications([certification({ id: 'cert-1', name: 'AWS SA' })])

    const { wrapper } = mountStep()
    await flushPromises()

    expect(continueButton(wrapper)?.attributes('disabled')).toBeDefined()

    await wrapper.find('[data-testid="cert-option"]').trigger('click')
    await flushPromises()

    expect(continueButton(wrapper)?.attributes('disabled')).toBeUndefined()
  })

  it('emits the chosen certificationId when Continue is activated', async () => {
    stubCertifications([
      certification({ id: 'cert-1', name: 'AWS SA' }),
      certification({ id: 'cert-2', name: 'Azure Fundamentals', provider: 'Azure' }),
    ])

    const { wrapper } = mountStep()
    await flushPromises()

    await wrapper.findAll('[data-testid="cert-option"]')[1]?.trigger('click')
    await flushPromises()

    await continueButton(wrapper)?.trigger('click')

    expect(wrapper.emitted('continue')?.at(-1)).toEqual(['cert-2'])
  })

  it('does not emit when Continue is activated without a selection', async () => {
    stubCertifications([certification({ id: 'cert-1', name: 'AWS SA' })])

    const { wrapper } = mountStep()
    await flushPromises()

    await continueButton(wrapper)?.trigger('click')

    expect(wrapper.emitted('continue')).toBeUndefined()
  })
})
