import type { QuestionFormat } from '@readion/shared'
import { describe, expect, it } from 'vitest'
import type { WeakAreaDto } from '../weak-areas/weak-areas.service'
import type { ItemPlan } from './session-planner'
import { buildItemPlan, resolveSessionConfig, resolveTargetDomains } from './session-planner'

describe('session-planner', () => {
  describe('buildItemPlan', () => {
    it('30-minute balanced session produces ~4 reading blocks and ~12 quiz items', () => {
      const plan = buildItemPlan({
        durationMinutes: 30,
        contentMix: 'balanced',
        difficulty: 'intermediate',
        targetDomains: ['Security', 'Networking'],
        certificationId: 'cert-1',
      })

      const reading = plan.filter((i: ItemPlan) => i.type === 'reading')
      const quiz = plan.filter((i: ItemPlan) => i.type === 'quiz')

      expect(reading.length).toBeGreaterThanOrEqual(3)
      expect(reading.length).toBeLessThanOrEqual(8)
      expect(quiz.length).toBeGreaterThanOrEqual(9)
      expect(quiz.length).toBeLessThanOrEqual(24)
      expect(plan.length).toBe(reading.length + quiz.length)
    })

    it('first item in the plan is a reading block', () => {
      const plan = buildItemPlan({
        durationMinutes: 30,
        contentMix: 'balanced',
        difficulty: 'intermediate',
        targetDomains: ['Security'],
        certificationId: 'cert-1',
      })

      expect(plan[0]!.type).toBe('reading')
    })

    it('items are indexed sequentially starting from 0', () => {
      const plan = buildItemPlan({
        durationMinutes: 15,
        contentMix: 'balanced',
        difficulty: 'beginner',
        targetDomains: ['Cloud'],
        certificationId: 'cert-1',
      })

      plan.forEach((item: ItemPlan, i: number) => {
        expect(item.index).toBe(i)
      })
    })

    it('quiz item format is deterministic for same inputs', () => {
      const plan1 = buildItemPlan({
        durationMinutes: 30,
        contentMix: 'balanced',
        difficulty: 'exam-ready',
        targetDomains: ['Security'],
        certificationId: 'cert-1',
      })
      const plan2 = buildItemPlan({
        durationMinutes: 30,
        contentMix: 'balanced',
        difficulty: 'exam-ready',
        targetDomains: ['Security'],
        certificationId: 'cert-1',
      })

      const quizItems1 = plan1.filter((i: ItemPlan) => i.type === 'quiz')
      const quizItems2 = plan2.filter((i: ItemPlan) => i.type === 'quiz')

      quizItems1.forEach((item: ItemPlan, i: number) => {
        expect(item.format).toBe(quizItems2[i]!.format)
      })
    })

    it('exam-ready difficulty uses scenario format for some items', () => {
      const plan = buildItemPlan({
        durationMinutes: 60,
        contentMix: 'balanced',
        difficulty: 'exam-ready',
        targetDomains: ['Security', 'Networking', 'Compute'],
        certificationId: 'cert-1',
      })

      const quizItems = plan.filter((i: ItemPlan) => i.type === 'quiz')
      const formats = quizItems.map((i: ItemPlan) => i.format as QuestionFormat)
      expect(formats.some((f: QuestionFormat) => f === 'scenario')).toBe(true)
    })

    it('reading-heavy session has more reading blocks relative to quiz items', () => {
      const heavy = buildItemPlan({
        durationMinutes: 30,
        contentMix: 'reading-heavy',
        difficulty: 'intermediate',
        targetDomains: ['Security'],
        certificationId: 'cert-1',
      })
      const balanced = buildItemPlan({
        durationMinutes: 30,
        contentMix: 'balanced',
        difficulty: 'intermediate',
        targetDomains: ['Security'],
        certificationId: 'cert-1',
      })

      const heavyRatio = heavy.filter((i: ItemPlan) => i.type === 'reading').length / heavy.length
      const balancedRatio =
        balanced.filter((i: ItemPlan) => i.type === 'reading').length / balanced.length
      expect(heavyRatio).toBeGreaterThan(balancedRatio)
    })

    it('quiz-heavy session has fewer reading blocks relative to quiz items', () => {
      const quizHeavy = buildItemPlan({
        durationMinutes: 30,
        contentMix: 'quiz-heavy',
        difficulty: 'intermediate',
        targetDomains: ['Security'],
        certificationId: 'cert-1',
      })
      const balanced = buildItemPlan({
        durationMinutes: 30,
        contentMix: 'balanced',
        difficulty: 'intermediate',
        targetDomains: ['Security'],
        certificationId: 'cert-1',
      })

      const heavyRatio =
        quizHeavy.filter((i: ItemPlan) => i.type === 'reading').length / quizHeavy.length
      const balancedRatio =
        balanced.filter((i: ItemPlan) => i.type === 'reading').length / balanced.length
      expect(heavyRatio).toBeLessThan(balancedRatio)
    })

    it('specific focus area restricts domains to only those specified', () => {
      const plan = buildItemPlan({
        durationMinutes: 30,
        contentMix: 'balanced',
        difficulty: 'intermediate',
        targetDomains: ['Networking'],
        certificationId: 'cert-1',
      })

      plan.forEach((item: ItemPlan) => {
        expect(item.domain).toBe('Networking')
      })
    })
  })

  describe('resolveSessionConfig', () => {
    it('uses request values when provided', () => {
      const config = resolveSessionConfig(
        {
          durationMinutes: 30,
          contentMix: 'quiz-heavy',
          difficulty: 'exam-ready',
          focusArea: { mode: 'auto' },
          learningStyle: 'cram',
        },
        null,
      )

      expect(config.durationMinutes).toBe(30)
      expect(config.contentMix).toBe('quiz-heavy')
      expect(config.difficulty).toBe('exam-ready')
      expect(config.learningStyle).toBe('cram')
    })

    it('falls back to enrollment defaults when request fields are omitted', () => {
      const config = resolveSessionConfig(
        { contentMix: 'quiz-heavy' },
        {
          durationMinutes: 60,
          difficulty: 'exam-ready',
          contentMix: 'balanced',
          focusArea: { mode: 'auto' },
          learningStyle: 'spaced-repetition',
        },
      )

      expect(config.durationMinutes).toBe(60)
      expect(config.contentMix).toBe('quiz-heavy')
      expect(config.difficulty).toBe('exam-ready')
      expect(config.learningStyle).toBe('spaced-repetition')
    })

    it('uses hardcoded defaults when neither request nor enrollment provides values', () => {
      const config = resolveSessionConfig({}, null)

      expect(config.durationMinutes).toBe(30)
      expect(config.contentMix).toBe('balanced')
      expect(config.difficulty).toBe('intermediate')
      expect(config.focusArea).toEqual({ mode: 'auto' })
      expect(config.learningStyle).toBe('weak-area-focus')
    })
  })

  describe('resolveTargetDomains', () => {
    it('auto focus area prioritizes weak domains (lowest score first)', () => {
      const weakAreas: WeakAreaDto[] = [
        {
          id: '1',
          domain: 'Security',
          score: 0.3,
          accuracy: 0.5,
          meanConfidence: 0.5,
          responseCount: 5,
        },
        {
          id: '2',
          domain: 'Networking',
          score: 0.7,
          accuracy: 0.8,
          meanConfidence: 0.7,
          responseCount: 3,
        },
        {
          id: '3',
          domain: 'Compute',
          score: 0.5,
          accuracy: 0.6,
          meanConfidence: 0.6,
          responseCount: 4,
        },
      ]

      const domains = resolveTargetDomains({ mode: 'auto' }, weakAreas, [
        'Security',
        'Networking',
        'Compute',
      ])

      expect(domains[0]).toBe('Security')
    })

    it('specific domain focus returns only those domains', () => {
      const domains = resolveTargetDomains(
        { mode: 'domains', domains: ['Networking'] },
        [],
        ['Security', 'Networking', 'Compute'],
      )

      expect(domains).toEqual(['Networking'])
    })

    it('auto focus without weak areas returns all cert domains', () => {
      const domains = resolveTargetDomains({ mode: 'auto' }, [], ['Security', 'Networking'])

      expect(domains).toEqual(['Security', 'Networking'])
    })
  })
})
