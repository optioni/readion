import { describe, expect, it } from 'vitest'
import { AnalyticsWindow, type Clock } from './analytics-window'

const fixedClock = (instant: Date): Clock => ({ now: () => instant })

describe('AnalyticsWindow', () => {
  const now = new Date('2026-06-28T00:00:00.000Z')
  const windowDays = 14
  const window = new AnalyticsWindow(fixedClock(now))

  it('reports the injected clock instant', () => {
    expect(window.now()).toBe(now)
  })

  it('derives the trailing-window start from the injected instant', () => {
    expect(window.start(windowDays).getTime()).toBe(now.getTime() - windowDays * 86_400_000)
  })

  it('includes a timestamp exactly at the window start (boundary inclusive)', () => {
    expect(window.contains(window.start(windowDays), windowDays)).toBe(true)
  })

  it('excludes a timestamp one millisecond before the window start', () => {
    const justBefore = new Date(window.start(windowDays).getTime() - 1)
    expect(window.contains(justBefore, windowDays)).toBe(false)
  })
})
