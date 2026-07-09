import type { SessionDefaults } from '@readion/shared'
import {
  DEFAULT_SESSION_DEFAULTS,
  sessionDefaultContentMixes,
  sessionDefaultContentMixLabels,
  sessionDefaultDifficulties,
  sessionDefaultDifficultyLabels,
  sessionDefaultDurations,
  sessionDefaultFocusAreas,
  sessionDefaultLearningStyleLabels,
  sessionDefaultLearningStyles,
} from '@readion/shared'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import OnboardingSessionPrefs from '~/components/OnboardingSessionPrefs.vue'
import { usersControllerGetMe } from '~~/src/api/users/users'

vi.mock('~~/src/api/users/users')

const profileEnvelope = (sessionDefaults: SessionDefaults) => ({
  data: {
    data: {
      id: 'user-1',
      email: 'learner@example.com',
      role: 'student',
      displayName: 'Learner',
      displayTimezone: 'Europe/Helsinki',
      sessionDefaults,
    },
  },
  status: 200,
  headers: new Headers(),
})

function stubProfile(sessionDefaults: SessionDefaults) {
  vi.mocked(usersControllerGetMe).mockResolvedValue(
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
    profileEnvelope(sessionDefaults) as any,
  )
}

function mountStep(props: Record<string, unknown> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const wrapper = mount(OnboardingSessionPrefs, {
    props,
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  return { wrapper, queryClient }
}

const confirmButton = (wrapper: ReturnType<typeof mountStep>['wrapper']) =>
  wrapper.findAll('button').find((button) => /confirm|enroll/i.test(button.text()))

afterEach(() => {
  vi.clearAllMocks()
})

describe('OnboardingSessionPrefs options', () => {
  it('renders one control per enum value for every field', async () => {
    stubProfile(DEFAULT_SESSION_DEFAULTS)

    const { wrapper } = mountStep()
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

  it('renders the mapped human-readable label as pill text, never the raw enum slug', async () => {
    stubProfile(DEFAULT_SESSION_DEFAULTS)

    const { wrapper } = mountStep()
    await flushPromises()

    for (const value of sessionDefaultDifficulties) {
      const pill = wrapper.find(`[data-testid="difficulty-${value}"]`)
      expect(pill.text()).toBe(sessionDefaultDifficultyLabels[value])
      expect(pill.text()).not.toBe(value)
    }
    for (const value of sessionDefaultContentMixes) {
      const pill = wrapper.find(`[data-testid="content-mix-${value}"]`)
      expect(pill.text()).toBe(sessionDefaultContentMixLabels[value])
      expect(pill.text()).not.toBe(value)
    }
    for (const value of sessionDefaultLearningStyles) {
      const pill = wrapper.find(`[data-testid="learning-style-${value}"]`)
      expect(pill.text()).toBe(sessionDefaultLearningStyleLabels[value])
      expect(pill.text()).not.toBe(value)
    }
  })

  it('keeps every enum value selectable and unchanged even though the label is humanized', async () => {
    stubProfile(DEFAULT_SESSION_DEFAULTS)

    const { wrapper } = mountStep()
    await flushPromises()

    // The full set of options per field is unchanged at the value level — the reconciliation
    // decision keeps the authoritative packages/shared enums instead of the design's reduced set.
    expect(sessionDefaultDifficulties).toHaveLength(4)
    expect(sessionDefaultLearningStyles).toHaveLength(3)

    for (const value of sessionDefaultDifficulties) {
      expect(wrapper.find(`[data-testid="difficulty-${value}"]`).exists()).toBe(true)
    }
    for (const value of sessionDefaultLearningStyles) {
      expect(wrapper.find(`[data-testid="learning-style-${value}"]`).exists()).toBe(true)
    }

    await wrapper.find('[data-testid="difficulty-advanced"]').trigger('click')
    await confirmButton(wrapper)?.trigger('click')

    expect(wrapper.emitted('confirm')?.at(-1)).toEqual([
      { ...DEFAULT_SESSION_DEFAULTS, difficulty: 'advanced' },
    ])
  })

  it('exposes the prefs container', async () => {
    stubProfile(DEFAULT_SESSION_DEFAULTS)

    const { wrapper } = mountStep()
    await flushPromises()

    expect(wrapper.find('[data-testid="onboarding-session-prefs"]').exists()).toBe(true)
  })
})

describe('OnboardingSessionPrefs settings layout — duration slider', () => {
  it('renders Session length as a slider with a live "N min" readout snapping to the real options', async () => {
    stubProfile(DEFAULT_SESSION_DEFAULTS) // duration: 30

    const { wrapper } = mountStep({ layout: 'settings' })
    await flushPromises()

    const slider = wrapper.find('[data-testid="duration-slider"]')
    expect(slider.exists()).toBe(true)
    expect(slider.attributes('type')).toBe('range')
    expect(slider.attributes('min')).toBe('0')
    expect(slider.attributes('max')).toBe(String(sessionDefaultDurations.length - 1))
    expect(slider.attributes('step')).toBe('1')

    expect(wrapper.find('[data-testid="duration-readout"]').text()).toBe('30 min')

    // Index 2 → sessionDefaultDurations[2] === 60 — snaps to a real option, not a free value.
    await slider.setValue(2)
    expect(wrapper.find('[data-testid="duration-readout"]').text()).toBe('60 min')
    expect(wrapper.emitted('update')?.at(-1)?.[0]).toMatchObject({ duration: 60 })
  })

  it('does not render the duration pill buttons in the settings layout', async () => {
    stubProfile(DEFAULT_SESSION_DEFAULTS)

    const { wrapper } = mountStep({ layout: 'settings' })
    await flushPromises()

    for (const value of sessionDefaultDurations) {
      expect(wrapper.find(`[data-testid="duration-option-${value}"]`).exists()).toBe(false)
    }
  })
})

describe('OnboardingSessionPrefs settings layout — FieldRow, hint, and pill shape', () => {
  it('renders each field as a two-column FieldRow with the label to the left of the control', async () => {
    stubProfile(DEFAULT_SESSION_DEFAULTS)

    const { wrapper } = mountStep({ layout: 'settings' })
    await flushPromises()

    const label = wrapper.find('label')
    expect(label.exists()).toBe(true)

    // SettingsFieldRow's fixed-width label column sits beside the control (Group 3 design.md /
    // apps/web/tests/components/SettingsFieldRow.spec.ts pins the w-40 shrink-0 contract).
    const labelColumn = label.element.parentElement
    if (!labelColumn) {
      throw new Error('missing label column parent element')
    }
    expect(Array.from(labelColumn.classList)).toContain('w-40')
    expect(Array.from(labelColumn.classList)).toContain('shrink-0')
  })

  it('shows the "Default duration per session" hint under the Session length label', async () => {
    stubProfile(DEFAULT_SESSION_DEFAULTS)

    const { wrapper } = mountStep({ layout: 'settings' })
    await flushPromises()

    const hint = wrapper.find('[data-testid="field-row-hint"]')
    expect(hint.exists()).toBe(true)
    expect(hint.text()).toBe('Default duration per session')
  })

  it('renders pill chips fully rounded with a solid-primary selected state, not rounded-lg bordered buttons', async () => {
    stubProfile(DEFAULT_SESSION_DEFAULTS) // difficulty: intermediate (selected)

    const { wrapper } = mountStep({ layout: 'settings' })
    await flushPromises()

    const selected = wrapper.find('[data-testid="difficulty-intermediate"]')
    expect(selected.classes()).toContain('rounded-full')
    expect(selected.classes()).not.toContain('rounded-lg')
    expect(selected.classes()).toContain('bg-readion-primary')

    const unselected = wrapper.find('[data-testid="difficulty-beginner"]')
    expect(unselected.classes()).toContain('rounded-full')
    expect(unselected.classes()).not.toContain('bg-readion-primary')
  })

  it('still renders all five fields, including Focus area, in the settings layout', async () => {
    stubProfile(DEFAULT_SESSION_DEFAULTS)

    const { wrapper } = mountStep({ layout: 'settings' })
    await flushPromises()

    expect(wrapper.find('[data-testid="duration-slider"]').exists()).toBe(true)
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
})

describe('OnboardingSessionPrefs default (onboarding) layout — duration stays pill buttons', () => {
  it('keeps duration as clickable pill buttons with no slider', async () => {
    stubProfile(DEFAULT_SESSION_DEFAULTS)

    const { wrapper } = mountStep()
    await flushPromises()

    expect(wrapper.find('[data-testid="duration-slider"]').exists()).toBe(false)
    for (const value of sessionDefaultDurations) {
      expect(wrapper.find(`[data-testid="duration-option-${value}"]`).exists()).toBe(true)
    }
  })
})

describe('OnboardingSessionPrefs pre-fill', () => {
  it('pre-selects each control from the profile sessionDefaults', async () => {
    const defaults: SessionDefaults = {
      duration: 90,
      contentMix: 'quiz-heavy',
      difficulty: 'advanced',
      focusArea: 'review',
      learningStyle: 'scenario-based',
    }
    stubProfile(defaults)

    const { wrapper } = mountStep()
    await flushPromises()

    expect(wrapper.find('[data-testid="duration-option-90"]').attributes('aria-pressed')).toBe(
      'true',
    )
    expect(wrapper.find('[data-testid="content-mix-quiz-heavy"]').attributes('aria-pressed')).toBe(
      'true',
    )
    expect(wrapper.find('[data-testid="difficulty-advanced"]').attributes('aria-pressed')).toBe(
      'true',
    )
    expect(wrapper.find('[data-testid="focus-area-review"]').attributes('aria-pressed')).toBe(
      'true',
    )
    expect(
      wrapper.find('[data-testid="learning-style-scenario-based"]').attributes('aria-pressed'),
    ).toBe('true')
  })

  it('emits the full pre-filled defaults when confirmed without changes', async () => {
    stubProfile(DEFAULT_SESSION_DEFAULTS)

    const { wrapper } = mountStep()
    await flushPromises()

    await confirmButton(wrapper)?.trigger('click')

    expect(wrapper.emitted('confirm')?.at(-1)).toEqual([{ ...DEFAULT_SESSION_DEFAULTS }])
  })
})

describe('OnboardingSessionPrefs selection', () => {
  it('emits the chosen values for all five fields after changes', async () => {
    stubProfile(DEFAULT_SESSION_DEFAULTS)

    const { wrapper } = mountStep()
    await flushPromises()

    await wrapper.find('[data-testid="duration-option-60"]').trigger('click')
    await wrapper.find('[data-testid="learning-style-spaced-repetition"]').trigger('click')

    await confirmButton(wrapper)?.trigger('click')

    expect(wrapper.emitted('confirm')?.at(-1)).toEqual([
      {
        duration: 60,
        contentMix: 'balanced',
        difficulty: 'intermediate',
        focusArea: 'auto',
        learningStyle: 'spaced-repetition',
      },
    ])
  })
})
