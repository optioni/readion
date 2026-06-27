import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { DomainTag } from '@readion/shared'
import { embedMany, generateText, Output } from 'ai'
import { z } from 'zod'
import type { WorkerEnvConfig } from '../config/env.schema'
import type { CertFieldProposals } from '../content-pipeline/cert-extraction/cert-extraction.types'

const domainTagSchema = z.object({
  tags: z.array(
    z.object({
      domain: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
})

const fieldProposalSchema = <T extends z.ZodTypeAny>(value: T) =>
  z.object({ value, passage: z.string() }).nullable()

const certFieldProposalsSchema = z.object({
  domains: fieldProposalSchema(z.array(z.object({ name: z.string(), weight: z.number().int() }))),
  questionCount: fieldProposalSchema(z.number().int()),
  passingScore: fieldProposalSchema(z.number()),
  timeLimitMinutes: fieldProposalSchema(z.number().int()),
})

const entailmentSchema = z.object({ entailed: z.boolean() })

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

  private getCertPrefillModel() {
    const provider = this.config.get('AI_PROVIDER') ?? 'openai'
    const apiKey = this.config.get('AI_API_KEY')
    const modelId = this.config.get('AI_MODEL_CERTIFICATION_PREFILL') ?? 'gpt-4o-mini'

    if (provider === 'anthropic') {
      return createAnthropic({ apiKey })(modelId)
    }
    return createOpenAI({ apiKey })(modelId)
  }

  private getVerificationModel() {
    const provider = this.config.get('AI_PROVIDER') ?? 'openai'
    const apiKey = this.config.get('AI_API_KEY')
    const modelId = this.config.get('AI_MODEL_ANSWER_VERIFICATION') ?? 'gpt-4o'

    if (provider === 'anthropic') {
      return createAnthropic({ apiKey })(modelId)
    }
    return createOpenAI({ apiKey })(modelId)
  }

  async extractCertFields(
    sourceText: string,
    cert: { name: string; code?: string },
  ): Promise<CertFieldProposals> {
    const { output } = await generateText({
      model: this.getCertPrefillModel(),
      output: Output.object({ schema: certFieldProposalsSchema }),
      prompt: [
        'You extract official certification exam metadata from the source text below.',
        'Use ONLY the source text. Never infer, calculate, or invent a value that is not stated.',
        'For each field, return the value AND a passage copied VERBATIM from the source that states it.',
        'If the source does not state a field, return null for that field.',
        'domains: list each domain name with its integer weight (weights sum to 100).',
        'questionCount, passingScore, timeLimitMinutes: single numbers.',
        `Certification: ${cert.name}${cert.code ? ` (${cert.code})` : ''}`,
        '',
        'Source:',
        sourceText,
      ].join('\n'),
    })

    return (
      output ?? {
        domains: null,
        questionCount: null,
        passingScore: null,
        timeLimitMinutes: null,
      }
    )
  }

  async verifyFieldEntailment(value: unknown, passage: string): Promise<boolean> {
    const { output } = await generateText({
      model: this.getVerificationModel(),
      output: Output.object({ schema: entailmentSchema }),
      prompt: [
        'You are an independent verifier. Using ONLY the cited passage and no outside knowledge,',
        'decide whether the passage entails (directly states or supports) the proposed value.',
        `Proposed value: ${JSON.stringify(value)}`,
        `Cited passage: "${passage}"`,
      ].join('\n'),
    })

    return output?.entailed ?? false
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
