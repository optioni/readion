import { z } from 'zod'
import { zodCoerceNumber } from './helpers'

const AI_PROVIDERS = ['anthropic', 'openai'] as const
export type AiProvider = (typeof AI_PROVIDERS)[number]

export const AI_MAX_TOKENS_DEFAULTS = {
  'quiz-generation': 1024,
  'answer-verification': 512,
  'domain-tagging': 256,
  'agent-qa': 2048,
  'certification-prefill': 4096,
  'material-generation': 4096,
  'complex-reasoning': 8192,
} as const

export const aiEnvFragment = {
  AI_PROVIDER: z.enum(AI_PROVIDERS),
  AI_API_KEY: z.string().min(1).optional(),
  AI_MODEL_QUIZ_GENERATION: z.string().min(1),
  AI_MODEL_ANSWER_VERIFICATION: z.string().min(1),
  AI_MODEL_DOMAIN_TAGGING: z.string().min(1),
  AI_MODEL_AGENT_QA: z.string().min(1),
  AI_MODEL_CERTIFICATION_PREFILL: z.string().min(1),
  AI_MODEL_MATERIAL_GENERATION: z.string().min(1),
  AI_MODEL_COMPLEX_REASONING: z.string().min(1),
  AI_MAX_TOKENS_QUIZ_GENERATION: zodCoerceNumber().default(
    AI_MAX_TOKENS_DEFAULTS['quiz-generation'],
  ),
  AI_MAX_TOKENS_ANSWER_VERIFICATION: zodCoerceNumber().default(
    AI_MAX_TOKENS_DEFAULTS['answer-verification'],
  ),
  AI_MAX_TOKENS_DOMAIN_TAGGING: zodCoerceNumber().default(AI_MAX_TOKENS_DEFAULTS['domain-tagging']),
  AI_MAX_TOKENS_AGENT_QA: zodCoerceNumber().default(AI_MAX_TOKENS_DEFAULTS['agent-qa']),
  AI_MAX_TOKENS_CERTIFICATION_PREFILL: zodCoerceNumber().default(
    AI_MAX_TOKENS_DEFAULTS['certification-prefill'],
  ),
  AI_MAX_TOKENS_MATERIAL_GENERATION: zodCoerceNumber().default(
    AI_MAX_TOKENS_DEFAULTS['material-generation'],
  ),
  AI_MAX_TOKENS_COMPLEX_REASONING: zodCoerceNumber().default(
    AI_MAX_TOKENS_DEFAULTS['complex-reasoning'],
  ),
  AI_EMBEDDING_PROVIDER: z.enum(AI_PROVIDERS).default('openai'),
  AI_EMBEDDING_MODEL: z.string().min(1).default('text-embedding-3-small'),
  AI_EMBEDDING_API_KEY: z.string().min(1).optional(),
  AI_RESPONSE_CACHE_TTL_SECONDS: zodCoerceNumber().default(86_400),
}
