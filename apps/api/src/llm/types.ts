export const TASK_TYPES = [
  'quiz-generation',
  'answer-verification',
  'domain-tagging',
  'agent-qa',
  'certification-prefill',
  'material-generation',
  'complex-reasoning',
] as const

export type TaskType = (typeof TASK_TYPES)[number]

export type ModelTier = 'utility' | 'mid-tier' | 'thinking'

export type ModelInfo = {
  modelId: string
  tier: ModelTier
  maxOutputTokens: number
}

export type LlmUsage = {
  inputTokens: number | undefined
  outputTokens: number | undefined
  totalTokens: number | undefined
}

export type LlmGenerateResult = {
  text: string
  usage: LlmUsage
}
