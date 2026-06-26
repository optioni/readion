import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { DomainTag } from '@readion/shared'
import { embedMany, generateText, Output } from 'ai'
import { z } from 'zod'
import type { WorkerEnvConfig } from '../config/env.schema'

const domainTagSchema = z.object({
  tags: z.array(
    z.object({
      domain: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
})

@Injectable()
export class LlmService {
  constructor(private readonly config: ConfigService<WorkerEnvConfig>) {}

  private getLanguageModel() {
    const provider = this.config.get('AI_PROVIDER') ?? 'openai'
    const apiKey = this.config.get('AI_API_KEY')
    const modelId = this.config.get('AI_MODEL_DOMAIN_TAGGING') ?? 'gpt-4o-mini'

    if (provider === 'anthropic') {
      return createAnthropic({ apiKey })(modelId)
    }
    return createOpenAI({ apiKey })(modelId)
  }

  private getEmbeddingModel() {
    const provider = this.config.get('AI_PROVIDER') ?? 'openai'
    const apiKey = this.config.get('AI_API_KEY')
    const modelId = this.config.get('AI_EMBEDDING_MODEL') ?? 'text-embedding-3-small'

    if (provider === 'anthropic') {
      // Anthropic does not natively support embeddings; fall back to OpenAI
      const openaiKey = this.config.get('AI_API_KEY')
      return createOpenAI({ apiKey: openaiKey }).embedding(modelId)
    }
    return createOpenAI({ apiKey }).embedding(modelId)
  }

  async tagDomains(
    text: string,
    domains: string[],
    confidenceThreshold: number,
  ): Promise<DomainTag[]> {
    const { output } = await generateText({
      model: this.getLanguageModel(),
      output: Output.object({ schema: domainTagSchema }),
      prompt: [
        `Classify the following text excerpt against these certification domains: ${domains.join(', ')}.`,
        `For each relevant domain, provide a confidence score between 0 and 1.`,
        `Only include domains with confidence above ${confidenceThreshold}.`,
        `Text: ${text}`,
      ].join('\n'),
    })

    if (!output) return []
    return output.tags.filter((tag) => tag.confidence >= confidenceThreshold)
  }

  private getContentModel() {
    const provider = this.config.get('AI_PROVIDER') ?? 'openai'
    const apiKey = this.config.get('AI_API_KEY')
    const modelId = this.config.get('AI_MODEL_SESSION_FILL') ?? 'gpt-4o'

    if (provider === 'anthropic') {
      return createAnthropic({ apiKey })(modelId)
    }
    return createOpenAI({ apiKey })(modelId)
  }

  async generateContent(prompt: string): Promise<string> {
    const { text } = await generateText({
      model: this.getContentModel(),
      prompt,
    })
    return text
  }

  async embedTexts(texts: string[], batchSize = 100): Promise<number[][]> {
    const model = this.getEmbeddingModel()
    const results: number[][] = []

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      const { embeddings } = await embedMany({ model, values: batch })
      results.push(...embeddings)
    }

    return results
  }
}
