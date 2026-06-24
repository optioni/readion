import { describe, expect, it } from 'vitest'
import { resolveEnrollmentDecision } from './enrollment-decision'

describe('resolveEnrollmentDecision', () => {
  it('returns create when no existing enrollment', () => {
    expect(resolveEnrollmentDecision(null)).toBe('create')
  })

  it('returns restore when existing enrollment is archived', () => {
    expect(resolveEnrollmentDecision('archived')).toBe('restore')
  })

  it('returns conflict when existing enrollment is active', () => {
    expect(resolveEnrollmentDecision('active')).toBe('conflict')
  })
})
