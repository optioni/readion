import { describe, expect, it } from 'vitest'
import { mapValidationErrors } from './validation-errors'

describe('mapValidationErrors', () => {
  it('maps constraints to field + message pairs', () => {
    const result = mapValidationErrors([
      {
        property: 'email',
        constraints: { isEmail: 'must be an email', isNotEmpty: 'must not be empty' },
        children: [],
        value: '',
      },
    ])
    expect(result).toEqual(
      expect.arrayContaining([
        { field: 'email', message: 'must be an email' },
        { field: 'email', message: 'must not be empty' },
      ]),
    )
  })

  it('handles missing constraints gracefully', () => {
    const result = mapValidationErrors([
      {
        property: 'email',
        constraints: undefined,
        children: [],
        value: '',
      },
    ])
    expect(result).toEqual([])
  })
})
