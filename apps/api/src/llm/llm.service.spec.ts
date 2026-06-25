import type {
  LanguageModelV3,
  LanguageModelV3FinishReason,
  LanguageModelV3GenerateResult,
} from '@ai-sdk/provider'
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { MockLanguageModelV3 } from 'ai/test'
import type { Counter, Histogram } from 'prom-client'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { LlmService } from './llm.service'
import { ModelRegistryService } from './model-registry.service'
import type { ProviderAdapter } from './provider-adapter'

const INPUT_TOKENS = 10
const OUTPUT_TOKENS = 50

const FINISH_REASON_STOP: LanguageModelV3FinishReason = { unified: 'stop', raw: 'stop' }

function makeDoGenerate(text: string): LanguageModelV3GenerateResult {
  return {
    content: [{ type: 'text', text }],
    finishReason: FINISH_REASON_STOP,
    usage: {
      inputTokens: { total: INPUT_TOKENS, noCache: INPUT_TOKENS, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: OUTPUT_TOKENS, text: OUTPUT_TOKENS, reasoning: 0 },
    },
    warnings: [],
  }
}

function makeMockModel(text = 'Generated quiz question'): MockLanguageModelV3 {
  return new MockLanguageModelV3({ doGenerate: async () => makeDoGenerate(text) })
}

function makeRegistry(modelId = 'claude-haiku-4-5', maxOutputTokens = 1024): ModelRegistryService {
  return {
    resolve: vi.fn().mockReturnValue({ modelId, tier: 'utility', maxOutputTokens }),
  } as unknown as ModelRegistryService
}

function makeAdapter(model: LanguageModelV3): ProviderAdapter {
  return {
    getChatModel: vi.fn().mockReturnValue(model),
  } as unknown as ProviderAdapter
}

function makeMetrics() {
  const histogram: Partial<Histogram> = { observe: vi.fn() }
  const tokenCounter: Partial<Counter> = { inc: vi.fn() }
  const errorCounter: Partial<Counter> = { inc: vi.fn() }
  return { histogram, tokenCounter, errorCounter }
}

function makeService(
  model: LanguageModelV3,
  overrides: { registry?: ModelRegistryService } = {},
): { svc: LlmService; metrics: ReturnType<typeof makeMetrics>; registry: ModelRegistryService } {
  const registry = overrides.registry ?? makeRegistry()
  const adapter = makeAdapter(model)
  const metrics = makeMetrics()
  const svc = new LlmService(
    registry,
    adapter,
    metrics.histogram as Histogram,
    metrics.tokenCounter as Counter,
    metrics.errorCounter as Counter,
  )
  return { svc, metrics, registry }
}

describe('LlmService — generateText', () => {
  it('invokes the SDK with the model resolved for the task type', async () => {
    const model = makeMockModel()
    const registry = makeRegistry('claude-haiku-4-5', 1024)
    const { svc } = makeService(model, { registry })

    await svc.generateText({
      taskType: 'quiz-generation',
      messages: [{ role: 'user', content: 'test' }],
    })

    expect(registry.resolve).toHaveBeenCalledWith('quiz-generation')
  })

  it('applies the configured max-token budget to the SDK call', async () => {
    const model = makeMockModel()
    const registry = makeRegistry('claude-haiku-4-5', 512)
    const { svc } = makeService(model, { registry })

    await svc.generateText({
      taskType: 'quiz-generation',
      messages: [{ role: 'user', content: 'test' }],
    })

    expect(model.doGenerateCalls[0].maxOutputTokens).toBe(512)
  })

  it('returns normalized text from the SDK response', async () => {
    const { svc } = makeService(makeMockModel('What is EC2?'))
    const result = await svc.generateText({
      taskType: 'quiz-generation',
      messages: [{ role: 'user', content: 'test' }],
    })
    expect(result.text).toBe('What is EC2?')
  })

  it('returns normalized token usage from the SDK response', async () => {
    const { svc } = makeService(makeMockModel())
    const result = await svc.generateText({
      taskType: 'quiz-generation',
      messages: [{ role: 'user', content: 'test' }],
    })
    expect(result.usage.inputTokens).toBe(INPUT_TOKENS)
    expect(result.usage.outputTokens).toBe(OUTPUT_TOKENS)
  })

  it('passes system message to the SDK when provided', async () => {
    const model = makeMockModel()
    const { svc } = makeService(model)

    await svc.generateText({
      taskType: 'quiz-generation',
      messages: [{ role: 'user', content: 'test' }],
      system: 'You are a quiz generator.',
    })

    expect(model.doGenerateCalls[0].prompt).toEqual(
      expect.arrayContaining([expect.objectContaining({ role: 'system' })]),
    )
  })
})

describe('LlmService — instrumentation', () => {
  let exporter: InMemorySpanExporter
  let provider: NodeTracerProvider

  beforeAll(() => {
    exporter = new InMemorySpanExporter()
    provider = new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] })
    provider.register()
  })

  afterAll(() => {
    exporter.reset()
    void provider.shutdown()
  })

  it('records latency observation with model and use_case labels on success', async () => {
    exporter.reset()
    const { svc, metrics } = makeService(makeMockModel())
    await svc.generateText({
      taskType: 'quiz-generation',
      messages: [{ role: 'user', content: 'test' }],
    })

    expect(metrics.histogram.observe).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-haiku-4-5', use_case: 'quiz-generation' }),
      expect.any(Number),
    )
  })

  it('records token usage observations labelled model and use_case on success', async () => {
    const { svc, metrics } = makeService(makeMockModel())
    await svc.generateText({
      taskType: 'quiz-generation',
      messages: [{ role: 'user', content: 'test' }],
    })

    expect(metrics.tokenCounter.inc).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-haiku-4-5', use_case: 'quiz-generation' }),
      expect.any(Number),
    )
  })

  it('increments the error counter with model and use_case labels on failure', async () => {
    const failingModel = new MockLanguageModelV3({
      doGenerate: async () => {
        throw new Error('LLM API error')
      },
    })
    const { svc, metrics } = makeService(failingModel)

    await expect(
      svc.generateText({
        taskType: 'quiz-generation',
        messages: [{ role: 'user', content: 'test' }],
      }),
    ).rejects.toThrow('LLM API error')

    expect(metrics.errorCounter.inc).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-haiku-4-5', use_case: 'quiz-generation' }),
    )
  })

  it('wraps the LLM call in a tracing span', async () => {
    exporter.reset()
    const { svc } = makeService(makeMockModel())
    await svc.generateText({
      taskType: 'quiz-generation',
      messages: [{ role: 'user', content: 'test' }],
    })

    const spans = exporter.getFinishedSpans()
    expect(spans.length).toBeGreaterThan(0)
    expect(spans.some((s) => s.name.includes('quiz-generation'))).toBe(true)
  })
})

describe('LlmService — streamText', () => {
  it('invokes streamText and returns a stream result with the resolved model', async () => {
    const model = new MockLanguageModelV3({
      doStream: async () => ({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] })
            controller.enqueue({ type: 'text-start', id: 'id-1' })
            controller.enqueue({ type: 'text-delta', id: 'id-1', delta: 'Hello' })
            controller.enqueue({ type: 'text-end', id: 'id-1' })
            controller.enqueue({
              type: 'finish',
              finishReason: FINISH_REASON_STOP,
              usage: {
                inputTokens: { total: 5, noCache: 5, cacheRead: 0, cacheWrite: 0 },
                outputTokens: { total: 10, text: 10, reasoning: 0 },
              },
            })
            controller.close()
          },
        }),
      }),
    })
    const registry = makeRegistry('claude-haiku-4-5', 1024)
    const adapter = makeAdapter(model)
    const metrics = makeMetrics()
    const svc = new LlmService(
      registry,
      adapter,
      metrics.histogram as Histogram,
      metrics.tokenCounter as Counter,
      metrics.errorCounter as Counter,
    )

    const result = await svc.streamText({
      taskType: 'quiz-generation',
      messages: [{ role: 'user', content: 'test' }],
    })
    const chunks: string[] = []
    for await (const chunk of result.textStream) {
      chunks.push(chunk)
    }
    expect(chunks.join('')).toBe('Hello')
  })
})
