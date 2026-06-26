import { Module } from '@nestjs/common'
import { SessionsModule } from '../sessions/sessions.module'
import { WeakAreasModule } from '../weak-areas/weak-areas.module'
import { MockExamSummaryController, SessionSummaryController } from './session-summary.controller'
import { SessionSummaryService } from './session-summary.service'

@Module({
  imports: [SessionsModule, WeakAreasModule],
  controllers: [SessionSummaryController, MockExamSummaryController],
  providers: [SessionSummaryService],
})
export class SessionSummaryModule {}
