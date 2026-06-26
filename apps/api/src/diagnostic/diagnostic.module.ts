import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { MOCK_EXAM_GENERATION_QUEUE } from '@readion/shared'
import { DiagnosticController } from './diagnostic.controller'
import { DiagnosticService } from './diagnostic.service'

@Module({
  imports: [BullModule.registerQueue({ name: MOCK_EXAM_GENERATION_QUEUE })],
  controllers: [DiagnosticController],
  providers: [DiagnosticService],
})
export class DiagnosticModule {}
