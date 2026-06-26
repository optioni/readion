import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { SESSION_FILL_QUEUE } from '@readion/shared'
import { GroundingModule } from '../grounding/grounding.module'
import { LlmModule } from '../llm/llm.module'
import { QuizModule } from '../quiz/quiz.module'
import { WeakAreasModule } from '../weak-areas/weak-areas.module'
import { ReadingBlockComposerService } from './reading-block-composer.service'
import { SessionFillQueueService } from './session-fill-queue.service'
import { EnrollmentSessionsController, SessionsController } from './sessions.controller'
import { SessionsService } from './sessions.service'

@Module({
  imports: [
    BullModule.registerQueue({ name: SESSION_FILL_QUEUE }),
    QuizModule,
    WeakAreasModule,
    LlmModule,
    GroundingModule,
  ],
  controllers: [SessionsController, EnrollmentSessionsController],
  providers: [SessionsService, ReadingBlockComposerService, SessionFillQueueService],
  exports: [SessionsService],
})
export class SessionsModule {}
