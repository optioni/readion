import type { ValidationErrorItem } from '@readion/shared'
import type { ValidationError } from 'class-validator'

export function mapValidationErrors(errors: ValidationError[]): ValidationErrorItem[] {
  return errors.flatMap((err) => {
    const constraints = Object.values(err.constraints ?? {})
    return constraints.map((message) => ({
      field: err.property,
      message,
    }))
  })
}
