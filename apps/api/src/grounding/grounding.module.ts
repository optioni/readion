import { Module } from '@nestjs/common'
import { LlmModule } from '../llm/llm.module'
import { GroundedGenerationService } from './grounded-generation.service'
import { groundingMetricProviders } from './grounding.metrics'
import { QuarantineService } from './quarantine.service'
import { VerifierService } from './verifier.service'

@Module({
  imports: [LlmModule],
  providers: [
    VerifierService,
    GroundedGenerationService,
    QuarantineService,
    ...groundingMetricProviders(),
  ],
  exports: [GroundedGenerationService, QuarantineService, VerifierService],
})
export class GroundingModule {}
