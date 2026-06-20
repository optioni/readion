import { describe, expect, expectTypeOf, it } from 'vitest'
import { ERROR_TYPES } from './constants'
import type { ProblemDetails, ValidationErrorItem } from './types'

describe('ProblemDetails', () => {
  it('accepts minimal problem details without errors array', () => {
    const pd: ProblemDetails = {
      type: '/errors/not-found',
      title: 'Not Found',
      status: 404,
      detail: 'Certification abc does not exist',
    }
    expectTypeOf(pd.type).toEqualTypeOf<string>()
    expectTypeOf(pd.status).toEqualTypeOf<number>()
    expect(pd.errors).toBeUndefined()
  })

  it('accepts problem details with field errors', () => {
    const pd: ProblemDetails = {
      type: '/errors/validation-error',
      title: 'Unprocessable Entity',
      status: 422,
      detail: 'Validation failed',
      errors: [{ field: 'email', message: 'Email is already taken' }],
    }
    expectTypeOf(pd.errors![0]!.field).toEqualTypeOf<string>()
    expectTypeOf(pd.errors![0]!.message).toEqualTypeOf<string>()
    expect(pd.errors).toHaveLength(1)
  })
})

describe('ValidationErrorItem', () => {
  it('has field and message strings', () => {
    const item: ValidationErrorItem = {
      field: 'password',
      message: 'Must be at least 12 characters',
    }
    expectTypeOf(item.field).toEqualTypeOf<string>()
    expectTypeOf(item.message).toEqualTypeOf<string>()
    expect(item.field).toBe('password')
  })
})

describe('ERROR_TYPES', () => {
  it('VALIDATION is /errors/validation-error', () => {
    expect(ERROR_TYPES.VALIDATION).toBe('/errors/validation-error')
  })

  it('VALIDATION is a literal type not widened to string', () => {
    expectTypeOf(ERROR_TYPES.VALIDATION).toEqualTypeOf<'/errors/validation-error'>()
  })
})
