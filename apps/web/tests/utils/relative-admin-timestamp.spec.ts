import { describe, expect, it } from 'vitest'
import { formatRelativeAdminTimestamp } from '~/utils/relativeAdminTimestamp'

const NOW = new Date('2026-06-25T12:00:00.000Z')

describe('formatRelativeAdminTimestamp', () => {
  it('renders a duration for minutes ago', () => {
    expect(formatRelativeAdminTimestamp('2026-06-25T11:55:00.000Z', NOW)).toBe('5m ago')
  })

  it('renders a duration for hours ago', () => {
    expect(formatRelativeAdminTimestamp('2026-06-25T10:00:00.000Z', NOW)).toBe('2h ago')
  })

  it('renders a duration for days ago', () => {
    expect(formatRelativeAdminTimestamp('2026-06-22T12:00:00.000Z', NOW)).toBe('3 days ago')
  })

  it('renders "Just now" for sub-minute gaps', () => {
    expect(formatRelativeAdminTimestamp('2026-06-25T11:59:50.000Z', NOW)).toBe('Just now')
  })

  it('falls back to a short date beyond a week', () => {
    expect(formatRelativeAdminTimestamp('2026-06-01T12:00:00.000Z', NOW)).toBe('Jun 1')
  })

  it('renders "Today HH:MM" in clock style for the same UTC day', () => {
    expect(formatRelativeAdminTimestamp('2026-06-25T09:32:00.000Z', NOW, 'clock')).toBe(
      'Today 09:32',
    )
  })

  it('renders a short date + time in clock style for a prior day', () => {
    expect(formatRelativeAdminTimestamp('2026-06-22T18:41:00.000Z', NOW, 'clock')).toBe(
      'Jun 22 18:41',
    )
  })

  it('returns an em dash for an invalid timestamp', () => {
    expect(formatRelativeAdminTimestamp('not-a-date', NOW)).toBe('—')
  })
})
