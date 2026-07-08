import { Injectable } from '@nestjs/common'
import { trace } from '@opentelemetry/api'
import { InjectMetric } from '@willsoto/nestjs-prometheus'
import type { ModelMessage, StopCondition, StreamTextResult, ToolSet } from 'ai'
import { generateText, Output, streamText } from 'ai'
import type { Counter, Histogram } from 'prom-client'
import type { z } from 'zod'
import { ModelRegistryService } from './model-registry.service'
import { ProviderAdapter } from './provider-adapter'
import type { LlmGenerateResult, LlmUsage, TaskType } from './types'

export const LLM_DURATION_METRIC = 'readion_llm_request_duration_seconds'
export const LLM_TOKEN_USAGE_METRIC = 'readion_llm_token_usage_total'
export const LLM_ERRORS_METRIC = 'readion_llm_errors_total'

export type LlmGenerateOptions = {
  taskType: TaskType
  messages: ModelMessage[]
  system?: string
}

export type LlmStreamOptions = LlmGenerateOptions & {
  tools?: ToolSet
  stopWhen?: StopCondition<ToolSet> | Array<StopCondition<ToolSet>>
}

export type LlmObjectOptions<T> = LlmGenerateOptions & {
  schema: z.ZodType<T>
}

export type LlmObjectResult<T> = {
  object: T
  usage: LlmUsage
}

@Injectable()
export class LlmService {
  private readonly tracer = trace.getTracer('readion-llm')

  constructor(
    private readonly modelRegistry: ModelRegistryService,
    private readonly providerAdapter: ProviderAdapter,
    @InjectMetric(LLM_DURATION_METRIC)
    private readonly durationHistogram: Histogram,
    @InjectMetric(LLM_TOKEN_USAGE_METRIC)
    private readonly tokenCounter: Counter,
    @InjectMetric(LLM_ERRORS_METRIC)
    private readonly errorCounter: Counter,
  ) {}

  private makeLabels(modelId: string, taskType: TaskType) {
    return { model: modelId, use_case: taskType }
  }

  async generateText(options: LlmGenerateOptions): Promise<LlmGenerateResult> {
    const { modelId, maxOutputTokens } = this.modelRegistry.resolve(options.taskType)
    const model = this.providerAdapter.getChatModel(modelId)
    const labels = this.makeLabels(modelId, options.taskType)

    return this.tracer.startActiveSpan(
      `llm.generate.${options.taskType}`,
      { attributes: { 'llm.model': modelId, 'llm.use_case': options.taskType } },
      async (span) => {
        const start = Date.now()
        try {
          const result = await generateText({
            model,
            messages: options.messages,
            system: options.system,
            maxOutputTokens,
          })

          const durationSeconds = (Date.now() - start) / 1000
          this.durationHistogram.observe(labels, durationSeconds)
          this.tokenCounter.inc({ ...labels, token_type: 'input' }, result.usage.inputTokens ?? 0)
          this.tokenCounter.inc({ ...labels, token_type: 'output' }, result.usage.outputTokens ?? 0)

          return {
            text: result.text,
            usage: {
              inputTokens: result.usage.inputTokens,
              outputTokens: result.usage.outputTokens,
              totalTokens: result.usage.totalTokens,
            },
          }
        } catch (error) {
          this.errorCounter.inc(labels)
          span.recordException(error as Error)
          throw error
        } finally {
          span.end()
        }
      },
    )
  }

  async generateObject<T>(options: LlmObjectOptions<T>): Promise<LlmObjectResult<T>> {
    const { modelId, maxOutputTokens } = this.modelRegistry.resolve(options.taskType)
    const model = this.providerAdapter.getChatModel(modelId)
    const labels = this.makeLabels(modelId, options.taskType)

    return this.tracer.startActiveSpan(
      `llm.object.${options.taskType}`,
      { attributes: { 'llm.model': modelId, 'llm.use_case': options.taskType } },
      async (span) => {
        const start = Date.now()
        try {
          const result = await generateText({
            model,
            messages: options.messages,
            system: options.system,
            maxOutputTokens,
            output: Output.object({ schema: options.schema }),
          })

          const durationSeconds = (Date.now() - start) / 1000
          this.durationHistogram.observe(labels, durationSeconds)
          this.tokenCounter.inc({ ...labels, token_type: 'input' }, result.usage.inputTokens ?? 0)
          this.tokenCounter.inc({ ...labels, token_type: 'output' }, result.usage.outputTokens ?? 0)

          return {
            object: result.output,
            usage: {
              inputTokens: result.usage.inputTokens,
              outputTokens: result.usage.outputTokens,
              totalTokens: result.usage.totalTokens,
            },
          }
        } catch (error) {
          this.errorCounter.inc(labels)
          span.recordException(error as Error)
          throw error
        } finally {
          span.end()
        }
      },
    )
  }

  // biome-ignore lint/suspicious/noExplicitAny: Output generic requires the 'output' namespace which is not a regular type
  async streamText(options: LlmStreamOptions): Promise<StreamTextResult<ToolSet, any>> {
    const { modelId, maxOutputTokens } = this.modelRegistry.resolve(options.taskType)
    const model = this.providerAdapter.getChatModel(modelId)

    return this.tracer.startActiveSpan(
      `llm.stream.${options.taskType}`,
      { attributes: { 'llm.model': modelId, 'llm.use_case': options.taskType } },
      async (span) => {
        try {
          const result = streamText({
            model,
            messages: options.messages,
            system: options.system,
            maxOutputTokens,
            tools: options.tools,
            stopWhen: options.stopWhen,
          })
          span.end()
          return result
        } catch (error) {
          this.errorCounter.inc(this.makeLabels(modelId, options.taskType))
          span.recordException(error as Error)
          span.end()
          throw error
        }
      },
    )
  }
}
