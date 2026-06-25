import { ConfigService } from '@nestjs/config'
import { describe, expect, it } from 'vitest'
import type { EnvConfig } from '../config/env.schema'
import { ModelRegistryService } from './model-registry.service'
import type { TaskType } from './types'

function makeConfig(overrides: Partial<EnvConfig> = {}): ConfigService<EnvConfig> {
  const defaults: Partial<EnvConfig> = {
    AI_PROVIDER: 'anthropic',
    AI_MODEL_QUIZ_GENERATION: 'claude-haiku-4-5',
    AI_MODEL_ANSWER_VERIFICATION: 'claude-haiku-4-5',
    AI_MODEL_DOMAIN_TAGGING: 'claude-haiku-4-5',
    AI_MODEL_AGENT_QA: 'claude-sonnet-4-6',
    AI_MODEL_CERTIFICATION_PREFILL: 'claude-sonnet-4-6',
    AI_MODEL_MATERIAL_GENERATION: 'claude-sonnet-4-6',
    AI_MODEL_COMPLEX_REASONING: 'claude-opus-4-8',
    AI_MAX_TOKENS_QUIZ_GENERATION: 1024,
    AI_MAX_TOKENS_ANSWER_VERIFICATION: 512,
    AI_MAX_TOKENS_DOMAIN_TAGGING: 256,
    AI_MAX_TOKENS_AGENT_QA: 2048,
    AI_MAX_TOKENS_CERTIFICATION_PREFILL: 4096,
    AI_MAX_TOKENS_MATERIAL_GENERATION: 4096,
    AI_MAX_TOKENS_COMPLEX_REASONING: 8192,
    ...overrides,
  }
  return {
    get: (key: string) => (defaults as Record<string, unknown>)[key],
  } as ConfigService<EnvConfig>
}

describe('ModelRegistryService', () => {
  it('resolves quiz-generation to the configured utility model with correct token budget', () => {
    const svc = new ModelRegistryService(makeConfig())
    const info = svc.resolve('quiz-generation')
    expect(info.modelId).toBe('claude-haiku-4-5')
    expect(info.tier).toBe('utility')
    expect(info.maxOutputTokens).toBe(1024)
  })

  it('resolves answer-verification to utility tier', () => {
    const svc = new ModelRegistryService(makeConfig())
    const info = svc.resolve('answer-verification')
    expect(info.tier).toBe('utility')
    expect(info.modelId).toBe('claude-haiku-4-5')
    expect(info.maxOutputTokens).toBe(512)
  })

  it('resolves domain-tagging to utility tier', () => {
    const svc = new ModelRegistryService(makeConfig())
    const info = svc.resolve('domain-tagging')
    expect(info.tier).toBe('utility')
    expect(info.maxOutputTokens).toBe(256)
  })

  it('resolves agent-qa to mid-tier with configured model', () => {
    const svc = new ModelRegistryService(makeConfig())
    const info = svc.resolve('agent-qa')
    expect(info.modelId).toBe('claude-sonnet-4-6')
    expect(info.tier).toBe('mid-tier')
    expect(info.maxOutputTokens).toBe(2048)
  })

  it('resolves certification-prefill to mid-tier', () => {
    const svc = new ModelRegistryService(makeConfig())
    const info = svc.resolve('certification-prefill')
    expect(info.tier).toBe('mid-tier')
    expect(info.maxOutputTokens).toBe(4096)
  })

  it('resolves material-generation to mid-tier', () => {
    const svc = new ModelRegistryService(makeConfig())
    const info = svc.resolve('material-generation')
    expect(info.tier).toBe('mid-tier')
    expect(info.maxOutputTokens).toBe(4096)
  })

  it('resolves complex-reasoning to thinking tier', () => {
    const svc = new ModelRegistryService(makeConfig())
    const info = svc.resolve('complex-reasoning')
    expect(info.tier).toBe('thinking')
    expect(info.maxOutputTokens).toBe(8192)
  })

  it('resolves all seven supported task types without throwing', () => {
    const svc = new ModelRegistryService(makeConfig())
    const taskTypes: TaskType[] = [
      'quiz-generation',
      'answer-verification',
      'domain-tagging',
      'agent-qa',
      'certification-prefill',
      'material-generation',
      'complex-reasoning',
    ]
    for (const taskType of taskTypes) {
      expect(() => svc.resolve(taskType)).not.toThrow()
    }
  })

  it('uses independent token budgets per task type', () => {
    const svc = new ModelRegistryService(
      makeConfig({ AI_MAX_TOKENS_QUIZ_GENERATION: 512, AI_MAX_TOKENS_AGENT_QA: 4096 }),
    )
    expect(svc.resolve('quiz-generation').maxOutputTokens).toBe(512)
    expect(svc.resolve('agent-qa').maxOutputTokens).toBe(4096)
  })

  it('throws for an unknown task type', () => {
    const svc = new ModelRegistryService(makeConfig())
    expect(() => svc.resolve('unknown-task' as TaskType)).toThrow(/unknown task type/i)
  })
})
