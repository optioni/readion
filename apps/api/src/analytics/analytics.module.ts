import { Module } from '@nestjs/common'
import { AnalyticsService } from './analytics.service'
import { AnalyticsWindow, CLOCK, systemClock } from './analytics-window'

@Module({
  providers: [AnalyticsService, AnalyticsWindow, { provide: CLOCK, useValue: systemClock }],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
