import { describe, expect, it } from 'vitest'
import { ReadionProblemDetailsError } from '~/api/mutator'
import { registerErrorMessage } from '~/composables/registerErrorMessage'

function problem(status: number, type?: string) {
  return new ReadionProblemDetailsError({ title: 'error', status, type })
}

describe('registerErrorMessage', () => {
  it('returns the closed message for a 403 signups-disabled problem', () => {
    expect(registerErrorMessage(problem(403, '/errors/signups-disabled'))).toBe(
      'Registration is currently closed. Please check back later.',
    )
  })

  it('returns the taken-email message for a 409 conflict', () => {
    expect(registerErrorMessage(problem(409, '/errors/conflict'))).toBe(
      'An account with this email already registered.',
    )
  })

  it('returns null for a 422 validation problem (handled as field errors)', () => {
    expect(registerErrorMessage(problem(422, '/errors/validation-error'))).toBeNull()
  })

  it('returns null for a generic 403 without the signups-disabled type', () => {
    expect(registerErrorMessage(problem(403, '/errors/forbidden'))).toBeNull()
  })

  it('returns null for a non-problem error', () => {
    expect(registerErrorMessage(new Error('network'))).toBeNull()
  })
})
