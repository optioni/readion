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

  it('renders every certification the API returns without client-side filtering', async () => {
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
