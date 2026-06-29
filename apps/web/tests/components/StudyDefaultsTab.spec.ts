import type { SessionDefaults } from '@readion/shared'
import {
  DEFAULT_SESSION_DEFAULTS,
  sessionDefaultContentMixes,
  sessionDefaultDifficulties,
  sessionDefaultDurations,
  sessionDefaultFocusAreas,
  sessionDefaultLearningStyles,
} from '@readion/shared'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReadionProblemDetailsError } from '~/api/mutator'
import StudyDefaultsTab from '~/components/StudyDefaultsTab.vue'
import { settingsQueryKeys } from '~/composables/settingsQueryKeys'
import { usersControllerGetMe, usersControllerUpdateMe } from '~~/src/api/users/users'

vi.mock('~~/src/api/users/users')

const profileEnvelope = (sessionDefaults: SessionDefaults) => ({
  data: {
    data: {
      id: 'user-1',
      email: 'learner@example.com',
      role: 'user',
      emailVerified: true,
      displayTimezone: 'Europe/Helsinki',
      sessionDefaults,
    },
  },
  status: 200,
  headers: new Headers(),
})

function stubProfile(sessionDefaults: SessionDefaults = DEFAULT_SESSION_DEFAULTS) {
  vi.mocked(usersControllerGetMe).mockResolvedValue(
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
    profileEnvelope(sessionDefaults) as any,
  )
}

function mountTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  const wrapper = mount(StudyDefaultsTab, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  return { wrapper, queryClient, invalidateSpy }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('StudyDefaultsTab renders all five session defaults', () => {
  it('renders a control per enum value for every field seeded from the profile', async () => {
    stubProfile()
    const { wrapper } = mountTab()
    await flushPromises()

    for (const value of sessionDefaultDurations) {
      expect(wrapper.find(`[data-testid="duration-option-${value}"]`).exists()).toBe(true)
    }
    for (const value of sessionDefaultContentMixes) {
      expect(wrapper.find(`[data-testid="content-mix-${value}"]`).exists()).toBe(true)
    }
    for (const value of sessionDefaultDifficulties) {
      expect(wrapper.find(`[data-testid="difficulty-${value}"]`).exists()).toBe(true)
    }
    for (const value of sessionDefaultFocusAreas) {
      expect(wrapper.find(`[data-testid="focus-area-${value}"]`).exists()).toBe(true)
    }
    for (const value of sessionDefaultLearningStyles) {
      expect(wrapper.find(`[data-testid="learning-style-${value}"]`).exists()).toBe(true)
    }
  })

  it('pre-selects each control from the profile sessionDefaults', async () => {
    const defaults: SessionDefaults = {
      duration: 90,
      contentMix: 'quiz-heavy',
      difficulty: 'advanced',
      focusArea: 'review',
      learningStyle: 'scenario-based',
    }
    stubProfile(defaults)
    const { wrapper } = mountTab()
    await flushPromises()

    expect(wrapper.find('[data-testid="duration-option-90"]').attributes('aria-pressed')).toBe(
      'true',
    )
    expect(
      wrapper.find('[data-testid="learning-style-scenario-based"]').attributes('aria-pressed'),
    ).toBe('true')
  })

  it('does not render the onboarding Confirm button', async () => {
    stubProfile()
    const { wrapper } = mountTab()
    await flushPromises()

    const confirm = wrapper
      .findAll('button')
      .find((button) => /confirm|enroll/i.test(button.text()))
    expect(confirm).toBeUndefined()
  })
})

describe('StudyDefaultsTab save defaults', () => {
  it('PATCHes the chosen sessionDefaults and invalidates the profile query', async () => {
    stubProfile()
    vi.mocked(usersControllerUpdateMe).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      profileEnvelope(DEFAULT_SESSION_DEFAULTS) as any,
    )

    const { wrapper, invalidateSpy } = mountTab()
    await flushPromises()

    await wrapper.find('[data-testid="duration-option-60"]').trigger('click')
    await wrapper.find('[data-testid="learning-style-spaced-repetition"]').trigger('click')
    await wrapper.find('[data-testid="save-defaults-btn"]').trigger('click')
    await flushPromises()

    expect(usersControllerUpdateMe).toHaveBeenCalledTimes(1)
    expect(usersControllerUpdateMe).toHaveBeenCalledWith(
      expect.objectContaining({
        body: JSON.stringify({
          sessionDefaults: {
            duration: 60,
            contentMix: 'balanced',
            difficulty: 'intermediate',
            focusArea: 'auto',
            learningStyle: 'spaced-repetition',
          },
        }),
      }),
    )
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: settingsQueryKeys.profile() })
  })

  it('surfaces a save error inline and keeps the controls editable', async () => {
    stubProfile()
    vi.mocked(usersControllerUpdateMe).mockRejectedValue(
      new ReadionProblemDetailsError({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Invalid session defaults',
      }),
    )

    const { wrapper, invalidateSpy } = mountTab()
    await flushPromises()

    await wrapper.find('[data-testid="duration-option-60"]').trigger('click')
    await wrapper.find('[data-testid="save-defaults-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="study-defaults-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="duration-option-60"]').attributes('aria-pressed')).toBe(
      'true',
    )
    expect(invalidateSpy).not.toHaveBeenCalled()
  })
})
