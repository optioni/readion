import { describe, expect, it } from 'vitest'
import { readingCitationLabels, resolveCitationLabel } from '~/composables/citationLabels'

describe('resolveCitationLabel', () => {
  it('returns the first truthy candidate', () => {
    expect(resolveCitationLabel('aws.amazon.com', 'chunk-id')).toBe('aws.amazon.com')
  })

  it('skips blank or missing candidates', () => {
    expect(resolveCitationLabel(undefined, '', '  ', 'AWS Docs')).toBe('AWS Docs')
  })

  it('falls back to the generic "Source" label when no candidate resolves', () => {
    expect(resolveCitationLabel()).toBe('Source')
    expect(resolveCitationLabel(undefined, null)).toBe('Source')
  })
})

describe('readingCitationLabels', () => {
  it('never returns a raw content-chunk id, falling back to "Source" for each', () => {
    const labels = readingCitationLabels(['bb9dd4b7-e3e5-44e6-b006-1b6fd247e14b'], [])
    expect(labels).toEqual(['Source'])
  })

  it('passes supportingSpans through as-is since they are already human text', () => {
    const labels = readingCitationLabels([], ['AWS Organizations User Guide §SCP'])
    expect(labels).toEqual(['AWS Organizations User Guide §SCP'])
  })

  it('combines chunk-id fallbacks and supporting spans in order', () => {
    const labels = readingCitationLabels(
      ['bb9dd4b7-e3e5-44e6-b006-1b6fd247e14b'],
      ['AWS Organizations User Guide §SCP'],
    )
    expect(labels).toEqual(['Source', 'AWS Organizations User Guide §SCP'])
  })
})
