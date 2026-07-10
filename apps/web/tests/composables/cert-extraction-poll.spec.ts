import type { ExtractionStatusResponse } from '@readion/shared'
import { describe, expect, it } from 'vitest'
import { isTerminalWithoutFields } from '~/composables/certExtractionPoll'

function status(
  state: string,
  fields: ExtractionStatusResponse['fields'] = null,
): ExtractionStatusResponse {
  return { state, fields }
}

const GROUNDED_FIELDS: ExtractionStatusResponse['fields'] = {
  domains: { value: [{ name: 'Cloud', weight: 100 }], citation: { url: 'u', passage: 'p' } },
  questionCount: { value: 65, citation: { url: 'u', passage: 'p' } },
  passingScore: { value: 67, citation: { url: 'u', passage: 'p' } },
  timeLimitMinutes: { value: 130, citation: { url: 'u', passage: 'p' } },
}

describe('isTerminalWithoutFields', () => {
  it('is false when no data has arrived', () => {
    expect(isTerminalWithoutFields(undefined)).toBe(false)
  })

  it('is false while still polling without fields', () => {
    expect(isTerminalWithoutFields(status('active'))).toBe(false)
  })

  it('is false once fields are present', () => {
    expect(isTerminalWithoutFields(status('completed', GROUNDED_FIELDS))).toBe(false)
  })

  it('is true on a terminal state that produced no fields', () => {
    expect(isTerminalWithoutFields(status('failed'))).toBe(true)
    expect(isTerminalWithoutFields(status('completed'))).toBe(true)
  })
})
