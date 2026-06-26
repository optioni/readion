import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { SESSION_FILL_QUEUE } from '@readion/shared'
import { makeGaugeProvider } from '@willsoto/nestjs-prometheus'
import { LlmModule } from '../llm/llm.module'
import { ACTIVE_SESSIONS_GAUGE, SessionAbandonmentCron } from './session-abandonment.cron'
import { SessionFillProcessor } from './session-fill.processor'
import { SessionItemGeneratorService } from './session-item-generator.service'

@Module({
  imports: [BullModule.registerQueue({ name: SESSION_FILL_QUEUE }), LlmModule],
  providers: [
    SessionAbandonmentCron,
    SessionFillProcessor,
    SessionItemGeneratorService,
    makeGaugeProvider({
      name: ACTIVE_SESSIONS_GAUGE,
      help: 'Current number of active study sessions',
    }),
  ],
})
export class SessionsWorkerModule {}
