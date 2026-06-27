import { describe, expect, it } from 'vitest'
import { isDigestDue } from './digest-window'

const HELSINKI = 'Europe/Helsinki'
const NEW_YORK = 'America/New_York'

// Monday 2026-06-29, send-time Monday 09:00 local, sendWeekday=1 (Mon), sendHour=9.
// 06:00Z == Mon 09:00 Helsinki (UTC+3) / Mon 02:00 New_York (UTC-4).
// 13:00Z == Mon 16:00 Helsinki / Mon 09:00 New_York (UTC-4).
const HELSINKI_LOCAL_9 = new Date('2026-06-29T06:00:00Z')
const NEW_YORK_LOCAL_9 = new Date('2026-06-29T13:00:00Z')

describe('isDigestDue', () => {
  describe('table-driven local weekday + hour selection', () => {
    const cases: Array<{
      name: string
      now: Date
      displayTimezone: string
      expected: boolean
    }> = [
      {
        name: 'Helsinki user fires when it is Mon 09:00 in Helsinki',
        now: HELSINKI_LOCAL_9,
        displayTimezone: HELSINKI,
        expected: true,
      },
      {
        name: 'New_York user does NOT fire at the Helsinki send instant (local Mon 02:00)',
        now: HELSINKI_LOCAL_9,
        displayTimezone: NEW_YORK,
        expected: false,
      },
      {
        name: 'New_York user fires when it is Mon 09:00 in New_York',
        now: NEW_YORK_LOCAL_9,
        displayTimezone: NEW_YORK,
        expected: true,
      },
      {
        name: 'Helsinki user does NOT fire at the New_York send instant (local Mon 16:00)',
        now: NEW_YORK_LOCAL_9,
        displayTimezone: HELSINKI,
        expected: false,
      },
    ]

    for (const c of cases) {
      it(c.name, () => {
        expect(
          isDigestDue({
            now: c.now,
            displayTimezone: c.displayTimezone,
            digestOptOut: false,
            lastDigestSentAt: null,
            sendWeekday: 1,
            sendHour: 9,
          }),
        ).toBe(c.expected)
      })
    }
  })

  describe('DST awareness (US spring-forward 2026-03-08)', () => {
    it('fires for New_York Mon 09:00 EDT (post spring-forward, UTC-4)', () => {
      // 2026-03-09T13:00Z == Mon 09:00 New_York EDT
      expect(
        isDigestDue({
          now: new Date('2026-03-09T13:00:00Z'),
          displayTimezone: NEW_YORK,
          digestOptOut: false,
          lastDigestSentAt: null,
          sendWeekday: 1,
          sendHour: 9,
        }),
      ).toBe(true)
    })

    it('does NOT fire one hour later (local Mon 10:00 EDT)', () => {
      expect(
        isDigestDue({
          now: new Date('2026-03-09T14:00:00Z'),
          displayTimezone: NEW_YORK,
          digestOptOut: false,
          lastDigestSentAt: null,
          sendWeekday: 1,
          sendHour: 9,
        }),
      ).toBe(false)
    })

    it('fires for New_York Mon 09:00 EST (pre spring-forward, UTC-5)', () => {
      // 2026-03-02T14:00Z == Mon 09:00 New_York EST
      expect(
        isDigestDue({
          now: new Date('2026-03-02T14:00:00Z'),
          displayTimezone: NEW_YORK,
          digestOptOut: false,
          lastDigestSentAt: null,
          sendWeekday: 1,
          sendHour: 9,
        }),
      ).toBe(true)
    })
  })

  describe('weekday numbering (0=Sunday .. 6=Saturday, JS convention)', () => {
    it('treats sendWeekday=1 as Monday', () => {
      expect(
        isDigestDue({
          now: HELSINKI_LOCAL_9,
          displayTimezone: HELSINKI,
          digestOptOut: false,
          lastDigestSentAt: null,
          sendWeekday: 1,
          sendHour: 9,
        }),
      ).toBe(true)
    })

    it('does NOT fire on a non-matching weekday (Sunday expected, Monday now)', () => {
      expect(
        isDigestDue({
          now: HELSINKI_LOCAL_9,
          displayTimezone: HELSINKI,
          digestOptOut: false,
          lastDigestSentAt: null,
          sendWeekday: 0,
          sendHour: 9,
        }),
      ).toBe(false)
    })
  })

  describe('opt-out', () => {
    it('excludes opted-out users even when otherwise due', () => {
      expect(
        isDigestDue({
          now: HELSINKI_LOCAL_9,
          displayTimezone: HELSINKI,
          digestOptOut: true,
          lastDigestSentAt: null,
          sendWeekday: 1,
          sendHour: 9,
        }),
      ).toBe(false)
    })
  })

  describe('same-local-week suppression', () => {
    it('suppresses when a digest was already sent this local week', () => {
      // Local week starts Mon 2026-06-29 00:00 Helsinki == 2026-06-28T21:00Z.
      // A send at the fire instant is within the current local week.
      expect(
        isDigestDue({
          now: HELSINKI_LOCAL_9,
          displayTimezone: HELSINKI,
          digestOptOut: false,
          lastDigestSentAt: new Date('2026-06-29T06:00:00Z'),
          sendWeekday: 1,
          sendHour: 9,
        }),
      ).toBe(false)
    })

    it('does not suppress when last send was before the current local week', () => {
      // Previous week send is before 2026-06-28T21:00Z week start.
      expect(
        isDigestDue({
          now: HELSINKI_LOCAL_9,
          displayTimezone: HELSINKI,
          digestOptOut: false,
          lastDigestSentAt: new Date('2026-06-22T06:00:00Z'),
          sendWeekday: 1,
          sendHour: 9,
        }),
      ).toBe(true)
    })

    it('suppresses a send that landed exactly at the local week start', () => {
      expect(
        isDigestDue({
          now: HELSINKI_LOCAL_9,
          displayTimezone: HELSINKI,
          digestOptOut: false,
          lastDigestSentAt: new Date('2026-06-28T21:00:00Z'),
          sendWeekday: 1,
          sendHour: 9,
        }),
      ).toBe(false)
    })
  })
})
