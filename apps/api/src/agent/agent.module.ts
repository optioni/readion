import { BullModule, getQueueToken } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { EmbeddingService } from '../llm/embedding.service'
import { LlmModule } from '../llm/llm.module'
import { LlmService } from '../llm/llm.service'
import { ReadinessModule } from '../readiness/readiness.module'
import { ReadinessService } from '../readiness/readiness.service'
import { WeakAreasModule } from '../weak-areas/weak-areas.module'
import { WeakAreasService } from '../weak-areas/weak-areas.service'
import { AgentController, SessionAgentConversationsController } from './agent.controller'
import { agentMetricProviders } from './agent.metrics'
import { AgentConversationRepository } from './agent.repository'
import { AgentService } from './agent.service'
import { AgentRetrievalService } from './tools/agent-retrieval.service'
import { AGENT_MATERIAL_QUEUE_NAME, agentToolsConfigProvider } from './tools/agent-tools.config'
import { AgentToolsFactory } from './tools/agent-tools.factory'
import {
  AGENT_EMBEDDING_PORT,
  AGENT_MATERIAL_GENERATION_PORT,
  AGENT_MATERIAL_QUEUE,
  AGENT_PROVENANCE_PORT,
  AGENT_READINESS_PORT,
  AGENT_RETRIEVAL_PORT,
  AGENT_SESSION_HISTORY_PORT,
  AGENT_WEAK_AREAS_PORT,
} from './tools/agent-tools.types'
import { SessionHistoryReader } from './tools/session-history.reader'
import { SessionItemProvenanceReader } from './tools/session-item-provenance.reader'

@Module({
  imports: [
    BullModule.registerQueue({ name: AGENT_MATERIAL_QUEUE_NAME }),
    LlmModule,
    WeakAreasModule,
    ReadinessModule,
  ],
  controllers: [AgentController, SessionAgentConversationsController],
  providers: [
    ...agentMetricProviders(),
    AgentService,
    AgentConversationRepository,
    AgentToolsFactory,
    AgentRetrievalService,
    SessionItemProvenanceReader,
    SessionHistoryReader,
    agentToolsConfigProvider,
    { provide: AGENT_EMBEDDING_PORT, useExisting: EmbeddingService },
    { provide: AGENT_MATERIAL_GENERATION_PORT, useExisting: LlmService },
    { provide: AGENT_RETRIEVAL_PORT, useExisting: AgentRetrievalService },
    { provide: AGENT_PROVENANCE_PORT, useExisting: SessionItemProvenanceReader },
    { provide: AGENT_WEAK_AREAS_PORT, useExisting: WeakAreasService },
    { provide: AGENT_READINESS_PORT, useExisting: ReadinessService },
    { provide: AGENT_SESSION_HISTORY_PORT, useExisting: SessionHistoryReader },
    { provide: AGENT_MATERIAL_QUEUE, useExisting: getQueueToken(AGENT_MATERIAL_QUEUE_NAME) },
  ],
  exports: [AgentService, AgentConversationRepository],
})
export class AgentModule {}
