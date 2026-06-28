import { Inject, Injectable } from '@nestjs/common'
import { isWithinWindow, windowStart } from './analytics.stats'

export interface Clock {
  now(): Date
}

export const CLOCK = Symbol('ANALYTICS_CLOCK')

export const systemClock: Clock = {
  now: () => new Date(),
}

// Single source of truth for the reporting instant and the trailing-window boundary every
// analytics metric reasons about. The clock is injected so window-boundary behaviour can be
// pinned in tests, and every metric shares the same instant within one computation.
@Injectable()
export class AnalyticsWindow {
  constructor(@Inject(CLOCK) private readonly clock: Clock) {}

  now(): Date {
    return this.clock.now()
  }

  start(windowDays: number, now: Date = this.now()): Date {
    return windowStart(now, windowDays)
  }

  contains(at: Date, windowDays: number, now: Date = this.now()): boolean {
    return isWithinWindow(at, now, windowDays)
  }
}
