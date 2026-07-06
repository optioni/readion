import { ERROR_TYPES } from '@readion/shared'
import { ReadionProblemDetailsError } from '~/api/mutator'

// Maps a failed registration response to the banner message the signup page shows.
// Returns null when there is no global message to display — a 422 is surfaced as
// per-field errors instead, and unknown errors are swallowed silently as before.
export function registerErrorMessage(err: unknown): string | null {
  if (!(err instanceof ReadionProblemDetailsError)) {
    return null
  }

  if (err.status === 403 && err.type === ERROR_TYPES.SIGNUPS_DISABLED) {
    return 'Registration is currently closed. Please check back later.'
  }

  if (err.status === 409) {
    return 'An account with this email already registered.'
  }

  return null
}
