import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { EnvConfig } from '../config/env.schema'
import type { ModelInfo, ModelTier, TaskType } from './types'

type TaskConfig = {
  modelKey: keyof EnvConfig
  tokenKey: keyof EnvConfig
  tier: ModelTier
}

const TASK_CONFIG: Record<TaskType, TaskConfig> = {
  'quiz-generation': {
    modelKey: 'AI_MODEL_QUIZ_GENERATION',
    tokenKey: 'AI_MAX_TOKENS_QUIZ_GENERATION',
    tier: 'utility',
  },
  'answer-verification': {
    modelKey: 'AI_MODEL_ANSWER_VERIFICATION',
    tokenKey: 'AI_MAX_TOKENS_ANSWER_VERIFICATION',
    tier: 'utility',
  },
  'domain-tagging': {
    modelKey: 'AI_MODEL_DOMAIN_TAGGING',
    tokenKey: 'AI_MAX_TOKENS_DOMAIN_TAGGING',
    tier: 'utility',
  },
  'agent-qa': {
    modelKey: 'AI_MODEL_AGENT_QA',
    tokenKey: 'AI_MAX_TOKENS_AGENT_QA',
    tier: 'mid-tier',
  },
  'certification-prefill': {
    modelKey: 'AI_MODEL_CERTIFICATION_PREFILL',
    tokenKey: 'AI_MAX_TOKENS_CERTIFICATION_PREFILL',
    tier: 'mid-tier',
  },
  'material-generation': {
    modelKey: 'AI_MODEL_MATERIAL_GENERATION',
    tokenKey: 'AI_MAX_TOKENS_MATERIAL_GENERATION',
    tier: 'mid-tier',
  },
  'complex-reasoning': {
    modelKey: 'AI_MODEL_COMPLEX_REASONING',
    tokenKey: 'AI_MAX_TOKENS_COMPLEX_REASONING',
    tier: 'thinking',
  },
}

@Injectable()
export class ModelRegistryService {
  constructor(private readonly config: ConfigService<EnvConfig>) {}

  resolve(taskType: TaskType): ModelInfo {
    const taskCfg = TASK_CONFIG[taskType]
    if (!taskCfg) {
      throw new Error(`Unknown task type: ${taskType}`)
    }

    const modelId = this.config.get<string>(taskCfg.modelKey)
    const maxOutputTokens = this.config.get<number>(taskCfg.tokenKey)

    if (!modelId || maxOutputTokens === undefined) {
      throw new Error(`Missing config for task type: ${taskType}`)
    }

    return { modelId, tier: taskCfg.tier, maxOutputTokens }
  }
}
