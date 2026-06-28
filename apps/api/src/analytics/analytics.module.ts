import { Module } from '@nestjs/common'
import { ReadinessModule } from '../readiness/readiness.module'
import { AnalyticsService } from './analytics.service'
import { AnalyticsWindow, CLOCK, systemClock } from './analytics-window'
import { AsOfReadiness } from './as-of-readiness'

@Module({
  imports: [ReadinessModule],
  providers: [
    AnalyticsService,
    AnalyticsWindow,
    AsOfReadiness,
    { provide: CLOCK, useValue: systemClock },
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
