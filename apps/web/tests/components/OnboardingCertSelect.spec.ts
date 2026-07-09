import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import OnboardingCertSelect from '~/components/OnboardingCertSelect.vue'
import { certificationsControllerList } from '~~/src/api/certifications/certifications'

vi.mock('~~/src/api/certifications/certifications')

const certification = (overrides: {
  id: string
  name: string
  provider?: string
  code?: string
}) => ({
  id: overrides.id,
  name: overrides.name,
  provider: overrides.provider ?? 'AWS',
  code: overrides.code ?? 'SAA-C03',
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

const groupHeaders = (wrapper: ReturnType<typeof mountStep>['wrapper']) =>
  wrapper.findAll('[data-testid="cert-group-header"]')

afterEach(() => {
  vi.clearAllMocks()
})

describe('OnboardingCertSelect grouping', () => {
  it('groups options under an uppercase provider header and shows name + code on each row', async () => {
    stubCertifications([
      certification({ id: 'cert-1', name: 'Solutions Architect - Associate', provider: 'AWS' }),
      certification({ id: 'cert-2', name: 'Fundamentals', provider: 'Azure', code: 'AZ-900' }),
    ])

    const { wrapper } = mountStep()
    await flushPromises()

    const headers = groupHeaders(wrapper)
    expect(headers).toHaveLength(2)
    expect(headers[0]?.text()).toBe('AWS')
    expect(headers[0]?.classes()).toContain('uppercase')
    expect(headers[1]?.text()).toBe('Azure')

    const optionEls = wrapper.findAll('[data-testid="cert-option"]')
    expect(optionEls).toHaveLength(2)
    expect(optionEls[0]?.text()).toContain('Solutions Architect - Associate')
    expect(optionEls[0]?.text()).toContain('SAA-C03')
    expect(optionEls[0]?.text()).not.toContain('AWS')
    expect(optionEls[1]?.text()).toContain('Fundamentals')
    expect(optionEls[1]?.text()).toContain('AZ-900')
  })

  it('buckets multiple certifications under the same provider into a single group', async () => {
    stubCertifications([
      certification({ id: 'cert-1', name: 'Solutions Architect - Associate', code: 'SAA-C03' }),
      certification({ id: 'cert-2', name: 'Developer - Associate', code: 'DVA-C02' }),
      certification({ id: 'cert-3', name: 'Azure Fundamentals', provider: 'Azure', code: 'AZ-900' }),
    ])

    const { wrapper } = mountStep()
    await flushPromises()

    expect(groupHeaders(wrapper)).toHaveLength(2)
    const groups = wrapper.findAll('[data-testid="cert-group"]')
    expect(groups[0]?.findAll('[data-testid="cert-option"]')).toHaveLength(2)
    expect(groups[1]?.findAll('[data-testid="cert-option"]')).toHaveLength(1)
  })

  it('renders groups in the stable order providers first appear in the catalog', async () => {
    stubCertifications([
      certification({ id: 'cert-1', name: 'Azure Fundamentals', provider: 'Azure', code: 'AZ-900' }),
      certification({ id: 'cert-2', name: 'AWS Solutions Architect', provider: 'AWS' }),
      certification({ id: 'cert-3', name: 'Azure Administrator', provider: 'Azure', code: 'AZ-104' }),
    ])

    const { wrapper } = mountStep()
    await flushPromises()

    const headers = groupHeaders(wrapper)
    expect(headers.map((header) => header.text())).toEqual(['Azure', 'AWS'])
  })

  it('does not crash on an empty certification list', async () => {
    stubCertifications([])

    const { wrapper } = mountStep()
    await flushPromises()

    expect(groupHeaders(wrapper)).toHaveLength(0)
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

  it('renders a leading search icon and a count suffix reflecting the total loaded catalog', async () => {
    stubCertifications([
      certification({ id: 'cert-1', name: 'AWS SA' }),
      certification({ id: 'cert-2', name: 'Azure Fundamentals', provider: 'Azure' }),
      certification({ id: 'cert-3', name: 'CKA', provider: 'CNCF' }),
    ])

    const { wrapper } = mountStep()
    await flushPromises()

    expect(wrapper.find('[data-testid="cert-search-icon"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cert-search-count"]').text()).toBe('3 available')
  })

  it('keeps the count reflecting the total catalog size, not the filtered subset', async () => {
    stubCertifications([
      certification({ id: 'cert-1', name: 'AWS SA' }),
      certification({ id: 'cert-2', name: 'Azure Fundamentals', provider: 'Azure' }),
      certification({ id: 'cert-3', name: 'CKA', provider: 'CNCF' }),
    ])

    const { wrapper } = mountStep()
    await flushPromises()

    await searchInput(wrapper).setValue('azure')
    await flushPromises()

    expect(wrapper.findAll('[data-testid="cert-option"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="cert-search-count"]').text()).toBe('3 available')
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

  it('hides a group entirely when none of its rows match the query, across multiple groups', async () => {
    stubCertifications([
      certification({ id: 'cert-1', name: 'AWS Solutions Architect' }),
      certification({ id: 'cert-2', name: 'AWS Developer', code: 'DVA-C02' }),
      certification({ id: 'cert-3', name: 'Azure Fundamentals', provider: 'Azure', code: 'AZ-900' }),
    ])

    const { wrapper } = mountStep()
    await flushPromises()

    await searchInput(wrapper).setValue('azure')
    await flushPromises()

    const headers = groupHeaders(wrapper)
    expect(headers).toHaveLength(1)
    expect(headers[0]?.text()).toBe('Azure')
    expect(wrapper.findAll('[data-testid="cert-option"]')).toHaveLength(1)
  })

  it('renders no options or groups for a non-matching query', async () => {
    stubCertifications([
      certification({ id: 'cert-1', name: 'AWS SA' }),
      certification({ id: 'cert-2', name: 'Azure Fundamentals', provider: 'Azure' }),
    ])

    const { wrapper } = mountStep()
    await flushPromises()

    await searchInput(wrapper).setValue('zzz-no-such-certification')
    await flushPromises()

    expect(wrapper.findAll('[data-testid="cert-option"]')).toHaveLength(0)
    expect(groupHeaders(wrapper)).toHaveLength(0)
  })

  it('restores the full grouped list when the query is cleared', async () => {
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
    expect(groupHeaders(wrapper)).toHaveLength(2)
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

  it('keeps a single selection when picking across different provider groups', async () => {
    stubCertifications([
      certification({ id: 'cert-1', name: 'AWS Solutions Architect' }),
      certification({ id: 'cert-2', name: 'Azure Fundamentals', provider: 'Azure' }),
    ])

    const { wrapper } = mountStep()
    await flushPromises()

    const options = wrapper.findAll('[data-testid="cert-option"]')
    await options[0]?.trigger('click')
    await flushPromises()
    expect(options[0]?.attributes('aria-pressed')).toBe('true')

    await options[1]?.trigger('click')
    await flushPromises()

    const optionsAfter = wrapper.findAll('[data-testid="cert-option"]')
    expect(optionsAfter[0]?.attributes('aria-pressed')).toBe('false')
    expect(optionsAfter[1]?.attributes('aria-pressed')).toBe('true')

    await continueButton(wrapper)?.trigger('click')
    expect(wrapper.emitted('continue')?.at(-1)).toEqual(['cert-2'])
  })
})
