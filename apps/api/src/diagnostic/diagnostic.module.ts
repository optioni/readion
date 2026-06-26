import { Module } from '@nestjs/common'
import { MockExamQueueModule } from '../mock-exam/mock-exam-queue.module'
import { DiagnosticController } from './diagnostic.controller'
import { DiagnosticService } from './diagnostic.service'

@Module({
  imports: [MockExamQueueModule],
  controllers: [DiagnosticController],
  providers: [DiagnosticService],
})
export class DiagnosticModule {}
