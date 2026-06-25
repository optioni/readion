import { describe, expect, it } from 'vitest'
import { planFormat } from './format-planner'

describe('planFormat (deterministic question-format planner)', () => {
  it('same inputs always yield the same format', () => {
    const chunk = { id: 'chunk-42', primaryDomain: 'compute' }
    const result1 = planFormat(chunk, 'intermediate')
    const result2 = planFormat(chunk, 'intermediate')
    expect(result1).toBe(result2)
  })

  it('same inputs with different difficulty yield the same format for same difficulty', () => {
    const chunk = { id: 'chunk-42', primaryDomain: 'compute' }
    expect(planFormat(chunk, 'beginner')).toBe(planFormat(chunk, 'beginner'))
    expect(planFormat(chunk, 'advanced')).toBe(planFormat(chunk, 'advanced'))
    expect(planFormat(chunk, 'exam-ready')).toBe(planFormat(chunk, 'exam-ready'))
  })

  it('never returns scenario at beginner difficulty', () => {
    for (let i = 0; i < 30; i++) {
      const chunk = { id: `chunk-${i}`, primaryDomain: 'compute' }
      expect(planFormat(chunk, 'beginner')).not.toBe('scenario')
    }
  })

  it('never returns scenario at intermediate difficulty', () => {
    for (let i = 0; i < 30; i++) {
      const chunk = { id: `chunk-${i}`, primaryDomain: 'networking' }
      expect(planFormat(chunk, 'intermediate')).not.toBe('scenario')
    }
  })

  it('never returns scenario at advanced difficulty', () => {
    for (let i = 0; i < 30; i++) {
      const chunk = { id: `chunk-${i}`, primaryDomain: 'security' }
      expect(planFormat(chunk, 'advanced')).not.toBe('scenario')
    }
  })

  it('only returns multiple_choice or true_false at non-exam-ready difficulties', () => {
    const difficulties = ['beginner', 'intermediate', 'advanced']
    for (const difficulty of difficulties) {
      for (let i = 0; i < 10; i++) {
        const chunk = { id: `chunk-${i}`, primaryDomain: 'compute' }
        const format = planFormat(chunk, difficulty)
        expect(['multiple_choice', 'true_false']).toContain(format)
      }
    }
  })

  it('may return scenario at exam-ready difficulty', () => {
    const formats = new Set<string>()
    for (let i = 0; i < 50; i++) {
      const chunk = { id: `chunk-${i}`, primaryDomain: 'compute' }
      formats.add(planFormat(chunk, 'exam-ready'))
    }
    expect(formats.has('scenario')).toBe(true)
  })

  it('returns only valid format values at exam-ready difficulty', () => {
    const validFormats = ['multiple_choice', 'true_false', 'scenario']
    for (let i = 0; i < 30; i++) {
      const chunk = { id: `chunk-${i}`, primaryDomain: 'storage' }
      expect(validFormats).toContain(planFormat(chunk, 'exam-ready'))
    }
  })

  it('different chunk ids with same difficulty may produce different formats', () => {
    const formats = new Set<string>()
    for (let i = 0; i < 20; i++) {
      const chunk = { id: `chunk-${i}`, primaryDomain: 'compute' }
      formats.add(planFormat(chunk, 'intermediate'))
    }
    expect(formats.size).toBeGreaterThan(1)
  })

  it('different primary domains with same chunk id and difficulty produce potentially different formats', () => {
    const domains = ['compute', 'networking', 'security', 'storage', 'databases']
    const formats = domains.map((d) => planFormat({ id: 'chunk-x', primaryDomain: d }, 'beginner'))
    expect(formats.every((f) => ['multiple_choice', 'true_false'].includes(f))).toBe(true)
  })

  it('is a pure function with no side effects', () => {
    const chunk = { id: 'chunk-test', primaryDomain: 'compute' }
    const before = { ...chunk }
    planFormat(chunk, 'intermediate')
    expect(chunk).toEqual(before)
  })
})
