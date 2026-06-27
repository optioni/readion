import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { CERT_EXTRACTION_QUEUE } from '@readion/shared'

@Module({
  imports: [BullModule.registerQueue({ name: CERT_EXTRACTION_QUEUE })],
  exports: [BullModule],
})
export class CertExtractionQueueModule {}
