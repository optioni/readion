import {
  sessionContentMixes,
  sessionDifficulties,
  sessionDurationMinutes,
  sessionLearningStyles,
} from '@readion/shared'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import SessionStartCustomConfig from '~/components/SessionStartCustomConfig.vue'
import { createSession } from '~/composables/sessionViewApi'
import { useCertDetail } from '~/composables/useCertDetail'
import { useCertWeakAreas } from '~/composables/useCertWeakAreas'

vi.mock('~/composables/sessionViewApi', () => ({ createSession: vi.fn() }))
vi.mock('~/composables/useCertDetail', () => ({ useCertDetail: vi.fn() }))
vi.mock('~/composables/useCertWeakAreas', () => ({ useCertWeakAreas: vi.fn() }))

const mockNavigate = vi.fn()
vi.stubGlobal('navigateTo', mockNavigate)

const DOMAINS = [
  { name: 'IAM & Security', weight: 30 },
  { name: 'Networking & CDN', weight: 20 },
  { name: 'Cost Optimization', weight: 15 },
]

function stubCertData() {
  // biome-ignore lint/suspicious/noExplicitAny: composable return narrowed to fields under test
  vi.mocked(useCertDetail).mockReturnValue({ domains: computed(() => DOMAINS) } as any)
  vi.mocked(useCertWeakAreas).mockReturnValue({
    weakAreas: computed(() => [
      { domain: 'IAM & Security', score: 45 },
      { domain: 'Networking & CDN', score: 43 },
    ]),
    // biome-ignore lint/suspicious/noExplicitAny: composable return narrowed to fields under test
  } as any)
}

function mountPanel() {
  return mount(SessionStartCustomConfig, { props: { enrollmentId: 'enr-1' } })
}

beforeEach(() => {
  stubCertData()
  // biome-ignore lint/suspicious/noExplicitAny: session detail narrowed to fields under assertion
  vi.mocked(createSession).mockResolvedValue({ data: { id: 'sess-1' }, relationships: {} } as any)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('SessionStartCustomConfig domain picker', () => {
  it('renders a toggle per cert domain with its weak score', () => {
    const wrapper = mountPanel()

    for (const domain of DOMAINS) {
      expect(wrapper.find(`[data-testid="domain-toggle-${domain.name}"]`).exists()).toBe(true)
    }
    expect(wrapper.find('[data-testid="domain-toggle-IAM & Security"]').text()).toContain('45')
    expect(wrapper.find('[data-testid="domain-toggle-Networking & CDN"]').text()).toContain('43')
  })

  it('starts with no domains selected', () => {
    const wrapper = mountPanel()
    expect(wrapper.find('[data-testid="domain-selected-count"]').text()).toContain('0 of 3')
  })

  it('select-all selects every domain and clear deselects them', async () => {
    const wrapper = mountPanel()

    await wrapper.find('[data-testid="domain-select-all"]').trigger('click')
    expect(wrapper.find('[data-testid="domain-selected-count"]').text()).toContain('3 of 3')

    await wrapper.find('[data-testid="domain-clear"]').trigger('click')
    expect(wrapper.find('[data-testid="domain-selected-count"]').text()).toContain('0 of 3')
  })
})

describe('SessionStartCustomConfig override controls', () => {
  it('offers exactly the contract-valid enum values', () => {
    const wrapper = mountPanel()

    for (const value of sessionDurationMinutes) {
      expect(wrapper.find(`[data-testid="duration-option-${value}"]`).exists()).toBe(true)
    }
    for (const value of sessionContentMixes) {
      expect(wrapper.find(`[data-testid="content-mix-${value}"]`).exists()).toBe(true)
    }
    for (const value of sessionDifficulties) {
      expect(wrapper.find(`[data-testid="difficulty-${value}"]`).exists()).toBe(true)
    }
    for (const value of sessionLearningStyles) {
      expect(wrapper.find(`[data-testid="learning-style-${value}"]`).exists()).toBe(true)
    }
  })

  it('drops the design-only values that are not in the contract', () => {
    const wrapper = mountPanel()

    expect(wrapper.find('[data-testid="duration-option-20"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="content-mix-questions"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="content-mix-concepts"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="difficulty-adaptive"]').exists()).toBe(false)
  })
})

describe('SessionStartCustomConfig start action', () => {
  it('preserves selected configuration and enables retry after failure', async () => {
    vi.mocked(createSession).mockRejectedValueOnce(new Error('unavailable'))
    const wrapper = mountPanel()

    await wrapper.find('[data-testid="domain-toggle-IAM & Security"]').trigger('click')
    await wrapper.find('[data-testid="domain-toggle-Networking & CDN"]').trigger('click')
    await wrapper.find('[data-testid="duration-option-30"]').trigger('click')
    await wrapper.find('[data-testid="custom-start-button"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="custom-start-error"]').attributes('role')).toBe('alert')
    expect(
      wrapper.find('[data-testid="domain-toggle-IAM & Security"]').attributes('aria-pressed'),
    ).toBe('true')
    expect(
      wrapper.find('[data-testid="domain-toggle-Networking & CDN"]').attributes('aria-pressed'),
    ).toBe('true')
    expect(wrapper.find('[data-testid="duration-option-30"]').attributes('aria-pressed')).toBe(
      'true',
    )
    expect(
      wrapper.find('[data-testid="custom-start-button"]').attributes('disabled'),
    ).toBeUndefined()
  })

  it('shows action-local progress and rejects duplicate start requests', async () => {
    let resolveSession!: (value: Awaited<ReturnType<typeof createSession>>) => void
    vi.mocked(createSession).mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve
      }),
    )
    const wrapper = mountPanel()
    const button = wrapper.find('[data-testid="custom-start-button"]')

    await button.trigger('click')
    await button.trigger('click')

    expect(createSession).toHaveBeenCalledTimes(1)
    expect(button.attributes('aria-busy')).toBe('true')
    expect(button.text()).toContain('Starting…')
    expect(button.find('[data-testid="readion-button-spinner"]').exists()).toBe(true)

    // biome-ignore lint/suspicious/noExplicitAny: session detail narrowed to fields under assertion
    resolveSession({ data: { id: 'sess-1' }, relationships: {} } as any)
  })

  it('posts only the chosen overrides with a domains focus area', async () => {
    const wrapper = mountPanel()

    await wrapper.find('[data-testid="domain-toggle-IAM & Security"]').trigger('click')
    await wrapper.find('[data-testid="domain-toggle-Networking & CDN"]').trigger('click')
    await wrapper.find('[data-testid="duration-option-30"]').trigger('click')

    await wrapper.find('[data-testid="custom-start-button"]').trigger('click')

    expect(createSession).toHaveBeenCalledWith('enr-1', {
      durationMinutes: 30,
      focusArea: { mode: 'domains', domains: ['IAM & Security', 'Networking & CDN'] },
    })
    expect(mockNavigate).toHaveBeenCalledWith('/sessions/sess-1')
  })

  it('posts an auto focus area when no domain is selected', async () => {
    const wrapper = mountPanel()

    await wrapper.find('[data-testid="custom-start-button"]').trigger('click')

    expect(createSession).toHaveBeenCalledWith('enr-1', { focusArea: { mode: 'auto' } })
  })

  it('emits use-defaults when the use-defaults link is clicked', async () => {
    const wrapper = mountPanel()

    await wrapper.find('[data-testid="use-defaults-link"]').trigger('click')

    expect(wrapper.emitted('use-defaults')).toHaveLength(1)
  })
})
