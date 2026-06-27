import { Processor } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import type { CertExtractionResult } from '@readion/shared'
import { CERT_EXTRACTION_QUEUE } from '@readion/shared'
import type { Job } from 'bullmq'
import { BaseProcessor } from '../../queue/base.processor'
import { CertExtractionService } from './cert-extraction.service'
import type { CertExtractionJobData } from './cert-extraction.types'

@Processor(CERT_EXTRACTION_QUEUE)
export class CertExtractionProcessor extends BaseProcessor {
  protected readonly logger = new Logger(CertExtractionProcessor.name)

  constructor(private readonly service: CertExtractionService) {
    super()
  }

  async handle(job: Job<CertExtractionJobData>): Promise<CertExtractionResult> {
    return this.service.extract(job.data)
  }
}
