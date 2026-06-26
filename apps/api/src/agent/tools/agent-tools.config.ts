import { ConfigService } from '@nestjs/config'
import { SIMILARITY_THRESHOLD_DEFAULT } from '@readion/shared'
import { AGENT_SEMANTIC_SEARCH_LIMIT_DEFAULT, type EnvConfig } from '../../config/env.schema'
import { AGENT_TOOLS_CONFIG, type AgentToolsConfig } from './agent-tools.types'

export const AGENT_ABSTENTION_GUIDANCE = [
  'Answer only from the retrieved context and cite the source chunks you used.',
  'When retrieval coverage is thin, abstain with "I don\'t have enough material on that"',
  'rather than guessing from general knowledge; an abstention may trigger fetchMoreMaterial.',
].join(' ')

export const DEFAULT_AGENT_TOOLS_CONFIG: AgentToolsConfig = {
  similarityThreshold: SIMILARITY_THRESHOLD_DEFAULT,
  semanticSearchLimit: AGENT_SEMANTIC_SEARCH_LIMIT_DEFAULT,
  abstentionGuidance: AGENT_ABSTENTION_GUIDANCE,
}

// Slow-path ingestion queue the agent module (Groups 5/6) must register via
// `BullModule.registerQueue({ name: AGENT_MATERIAL_QUEUE_NAME })`. A low priority
// number is higher priority in BullMQ, so on-demand material requests jump the line.
export const AGENT_MATERIAL_QUEUE_NAME = 'agent-material-request'
export const AGENT_MATERIAL_JOB_NAME = 'ingest-on-demand'
export const AGENT_MATERIAL_JOB_PRIORITY = 1

export function createAgentToolsConfig(config: ConfigService<EnvConfig, true>): AgentToolsConfig {
  return {
    similarityThreshold: config.get('AGENT_SIMILARITY_THRESHOLD', { infer: true }),
    semanticSearchLimit: config.get('AGENT_SEMANTIC_SEARCH_LIMIT', { infer: true }),
    abstentionGuidance: AGENT_ABSTENTION_GUIDANCE,
  }
}

export const agentToolsConfigProvider = {
  provide: AGENT_TOOLS_CONFIG,
  inject: [ConfigService],
  useFactory: createAgentToolsConfig,
}
