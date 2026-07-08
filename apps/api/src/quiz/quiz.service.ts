import { EntityManager } from '@mikro-orm/core'
import { Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { QuizResponse, UserCertification } from '@readion/db'
import type {
  ExplanationRequest,
  ExplanationResponse,
  ExtractiveItem,
  GenerateQuizRequest,
  InsufficientMaterialResponse,
  Provenance,
  QuestionFormat,
  QuizQuestionResponse,
  ReportRequest,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
} from '@readion/shared'
import { QUIZ_ANSWERED_EVENT } from '@readion/shared'
import { NoObjectGeneratedError } from 'ai'
import { z } from 'zod'
import type { GenerationFn, GroundedChunk } from '../grounding/grounded-generation.service'
import { GroundedGenerationService } from '../grounding/grounded-generation.service'
import { QuarantineService } from '../grounding/quarantine.service'
import { buildCacheKey } from '../llm/cache-key.builder'
import { EmbeddingService } from '../llm/embedding.service'
import { LlmService } from '../llm/llm.service'
import type { VerifiedPayload } from '../llm/llm-response-cache.service'
import { LlmResponseCacheService } from '../llm/llm-response-cache.service'
import { planFormat } from './format-planner'

type QuizCachePayload = { item: ExtractiveItem; provenance: Provenance; format: QuestionFormat }
type QuizCacheReadResult = {
  item: ExtractiveItem
  provenance: Provenance
  format: QuestionFormat | undefined
}

const llmExtractiveItemSchema = z.object({
  question: z.string(),
  options: z.array(z.string()),
  correctAnswer: z.string(),
  supportingSpans: z.array(z.string()),
  sourceChunkIds: z.array(z.string()),
})

export type GenerateResult =
  | { type: 'question'; data: QuizQuestionResponse }
  | InsufficientMaterialResponse

@Injectable()
export class QuizService {
  private readonly logger = new Logger(QuizService.name)

  constructor(
    private readonly em: EntityManager,
    private readonly groundedGeneration: GroundedGenerationService,
    private readonly quarantine: QuarantineService,
    private readonly cache: LlmResponseCacheService,
    private readonly embedding: EmbeddingService,
    private readonly llm: LlmService,
    private readonly events: EventEmitter2,
  ) {}

  async generate(
    userId: string,
    request: GenerateQuizRequest,
    options?: { excludeChunkIds?: string[] },
  ): Promise<GenerateResult> {
    const em = this.em.fork()

    const enrollment = await em.findOne(
      UserCertification,
      { id: request.userCertificationId, user: userId },
      { populate: ['certification'] },
    )

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found')
    }

    const cert = enrollment.certification
    if (cert.state !== 'live') {
      throw new UnprocessableEntityException(
        'Certification is not yet available for quiz generation',
      )
    }

    const queryEmbedding = await this.embedding.embed(request.domain)
    const chunks = await this.searchChunks(
      em,
      cert.id,
      queryEmbedding,
      request.domain,
      5,
      options?.excludeChunkIds ?? [],
    )

    if (chunks.length === 0) {
      return { type: 'insufficient_material', certificationId: cert.id, domain: request.domain }
    }

    const primaryChunk = chunks[0]!
    const format =
      request.format ??
      planFormat(
        { id: primaryChunk.id, primaryDomain: primaryChunk.primaryDomain },
        request.difficulty,
      )
    const chunkIds = chunks.map((c) => c.id)
    const cacheKey = buildCacheKey({
      certificationId: cert.id,
      chunkIds,
      difficulty: request.difficulty,
      format,
    })

    const cached = await this.cache.get(cacheKey)
    if (cached) {
      const { item, provenance } = this.readQuizPayload(cached)
      return {
        type: 'question',
        data: { id: cacheKey, format, question: item.question, options: item.options, provenance },
      }
    }

    const generationFn = this.buildQuizGenerationFn(format)
    const result = await this.groundedGeneration.generate(generationFn, chunks, {
      cacheKey,
      certificationId: cert.id,
      domain: request.domain,
    })

    if (!result.success) {
      return { type: 'insufficient_material', certificationId: cert.id, domain: request.domain }
    }

    await this.writeQuizCache(cacheKey, chunkIds, result.item, result.provenance, format)

    return {
      type: 'question',
      data: {
        id: cacheKey,
        format,
        question: result.item.question,
        options: result.item.options,
        provenance: result.provenance,
      },
    }
  }

  async generateFromChunk(
    userId: string,
    request: {
      userCertificationId: string
      anchorChunkId: string
      difficulty: GenerateQuizRequest['difficulty']
      format?: QuestionFormat
    },
  ): Promise<GenerateResult> {
    const em = this.em.fork()

    const enrollment = await em.findOne(
      UserCertification,
      { id: request.userCertificationId, user: userId },
      { populate: ['certification'] },
    )
    if (!enrollment) {
      throw new NotFoundException('Enrollment not found')
    }

    const cert = enrollment.certification
    if (cert.state !== 'live') {
      throw new UnprocessableEntityException(
        'Certification is not yet available for quiz generation',
      )
    }

    const chunks = await this.loadChunksByIds(em, [request.anchorChunkId])
    if (chunks.length === 0) {
      return { type: 'insufficient_material', certificationId: cert.id, domain: '' }
    }

    const primaryChunk = chunks[0]!
    const domain = primaryChunk.primaryDomain
    const format =
      request.format ??
      planFormat({ id: primaryChunk.id, primaryDomain: domain }, request.difficulty)
    const chunkIds = chunks.map((c) => c.id)
    const cacheKey = buildCacheKey({
      certificationId: cert.id,
      chunkIds,
      difficulty: request.difficulty,
      format,
    })

    const cached = await this.cache.get(cacheKey)
    if (cached) {
      const { item, provenance } = this.readQuizPayload(cached)
      return {
        type: 'question',
        data: { id: cacheKey, format, question: item.question, options: item.options, provenance },
      }
    }

    const generationFn = this.buildQuizGenerationFn(format)
    const result = await this.groundedGeneration.generate(generationFn, chunks, {
      cacheKey,
      certificationId: cert.id,
      domain,
    })

    if (!result.success) {
      return { type: 'insufficient_material', certificationId: cert.id, domain }
    }

    await this.writeQuizCache(cacheKey, chunkIds, result.item, result.provenance, format)

    return {
      type: 'question',
      data: {
        id: cacheKey,
        format,
        question: result.item.question,
        options: result.item.options,
        provenance: result.provenance,
      },
    }
  }

  async submitAnswer(
    userId: string,
    questionId: string,
    request: SubmitAnswerRequest,
  ): Promise<SubmitAnswerResponse> {
    const em = this.em.fork()

    const enrollment = await em.findOne(UserCertification, {
      id: request.userCertificationId,
      user: userId,
    })

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found')
    }

    const cached = await this.cache.get(questionId)
    if (!cached) {
      throw new UnprocessableEntityException('Question is no longer available')
    }

    const { item, provenance, format } = this.readQuizPayload(cached)
    const correct = item.correctAnswer === request.answer

    const responseEntity = em.create(QuizResponse, {
      userCertification: enrollment,
      answer: request.answer,
      correct,
      confidence: request.confidence,
      timeTakenMs: request.timeTakenMs,
      questionSnapshot: {
        question: item.question,
        options: item.options,
        correctAnswer: item.correctAnswer,
        provenance,
      },
      format: (format ?? 'multiple_choice') as QuestionFormat,
    })

    em.persist(responseEntity)
    await em.flush()

    await this.events.emitAsync(QUIZ_ANSWERED_EVENT, {
      userId,
      userCertificationId: enrollment.id,
      certificationId: enrollment.certification.id,
      sourceChunkIds: provenance.sourceChunkIds,
      correct,
      confidence: request.confidence,
    })

    return {
      id: responseEntity.id,
      correct,
      answer: request.answer,
      confidence: request.confidence,
      timeTakenMs: request.timeTakenMs,
      userCertificationId: enrollment.id,
    }
  }

  async generateExplanation(
    userId: string,
    questionId: string,
    request: ExplanationRequest,
  ): Promise<ExplanationResponse> {
    const em = this.em.fork()

    const enrollment = await em.findOne(
      UserCertification,
      { id: request.userCertificationId, user: userId },
      { populate: ['certification'] },
    )

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found')
    }

    const cached = await this.cache.get(questionId)
    if (!cached) {
      throw new UnprocessableEntityException('Question is no longer available')
    }

    const { item, provenance } = this.readQuizPayload(cached)
    const sourceChunkIds = provenance.sourceChunkIds
    const chunks = await this.loadChunksByIds(em, sourceChunkIds)

    if (chunks.length === 0) {
      throw new UnprocessableEntityException(
        'Source material for explanation is no longer available',
      )
    }

    const explanationCacheKey = buildCacheKey({
      certificationId: enrollment.certification.id,
      chunkIds: sourceChunkIds,
      difficulty: 'explanation',
      format: 'explanation',
    })

    const cachedExplanation = await this.cache.get(explanationCacheKey)
    if (cachedExplanation) {
      const { item: cachedItem } = this.readQuizPayload(cachedExplanation)
      return { explanation: cachedItem.question, citations: cachedItem.sourceChunkIds }
    }

    const explanationFn = this.buildExplanationGenerationFn(item)
    const result = await this.groundedGeneration.generate(explanationFn, chunks, {
      cacheKey: explanationCacheKey,
      certificationId: enrollment.certification.id,
      domain: 'explanation',
    })

    if (!result.success) {
      throw new UnprocessableEntityException('Unable to generate a grounded explanation')
    }

    return { explanation: result.item.question, citations: result.item.sourceChunkIds }
  }

  async reportQuestion(userId: string, questionId: string, request: ReportRequest): Promise<void> {
    const em = this.em.fork()

    const enrollment = await em.findOne(
      UserCertification,
      { id: request.userCertificationId, user: userId },
      { populate: ['certification'] },
    )

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found')
    }

    const cached = await this.cache.get(questionId)
    if (!cached) {
      throw new UnprocessableEntityException('Question is no longer available')
    }

    const { item, provenance, format } = this.readQuizPayload(cached)
    // The reported question's domain is not recoverable here: the quiz cache payload does not
    // persist it, and provenance only carries source-chunk ids. Persist an empty-safe domain
    // rather than blocking the quarantine write on a value this path cannot derive.
    // generatedContent captures item + format so an approved item can be faithfully rebuilt into
    // the verified-cache payload on reinstatement.
    await this.quarantine.quarantine(
      questionId,
      provenance,
      request.reason,
      enrollment.certification.id,
      '',
      { item, format },
    )
  }

  private readQuizPayload(cached: VerifiedPayload): QuizCacheReadResult {
    const parsed = JSON.parse(cached.text) as Partial<QuizCachePayload>
    if (!parsed.item || !parsed.provenance) {
      throw new UnprocessableEntityException('Question is no longer available')
    }
    return {
      item: parsed.item,
      provenance: parsed.provenance,
      format: parsed.format,
    }
  }

  private async writeQuizCache(
    cacheKey: string,
    chunkIds: string[],
    item: ExtractiveItem,
    provenance: Provenance,
    format: QuestionFormat,
  ): Promise<void> {
    await this.cache.set(cacheKey, chunkIds, {
      text: JSON.stringify({ item, provenance, format }),
      usage: { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined },
      verified: true,
    })
  }

  private async searchChunks(
    em: EntityManager,
    certificationId: string,
    queryEmbedding: number[],
    domain: string,
    limit = 5,
    excludeChunkIds: string[] = [],
  ): Promise<GroundedChunk[]> {
    const vectorLiteral = `[${queryEmbedding.join(',')}]`

    type ChunkRow = { id: string; text: string; primary_domain: string; similarity: number }

    const excludeClause =
      excludeChunkIds.length > 0
        ? `AND id NOT IN (${excludeChunkIds.map(() => '?').join(', ')})`
        : ''

    const rows = await em.getConnection().execute<ChunkRow[]>(
      `
      SELECT id, text, primary_domain, 1 - (embedding <=> ?::vector) AS similarity
      FROM content_chunks
      WHERE certification_id = ?
        AND state = 'active'
        AND embedding IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(domain_tags) AS tag
          WHERE tag->>'domain' = ?
        )
        ${excludeClause}
      ORDER BY embedding <=> ?::vector
      LIMIT ?
      `,
      [vectorLiteral, certificationId, domain, ...excludeChunkIds, vectorLiteral, limit],
    )

    return rows.map(
      (row: ChunkRow): GroundedChunk => ({
        id: row.id,
        text: row.text,
        primaryDomain: row.primary_domain,
        similarity: row.similarity,
      }),
    )
  }

  private async loadChunksByIds(em: EntityManager, chunkIds: string[]): Promise<GroundedChunk[]> {
    if (chunkIds.length === 0) return []

    type ChunkRow = { id: string; text: string; primary_domain: string }

    const placeholders = chunkIds.map(() => '?').join(', ')
    const rows = await em
      .getConnection()
      .execute<ChunkRow[]>(
        `SELECT id, text, primary_domain FROM content_chunks WHERE id IN (${placeholders}) AND state = 'active'`,
        chunkIds,
      )

    return rows.map(
      (row: ChunkRow): GroundedChunk => ({
        id: row.id,
        text: row.text,
        primaryDomain: row.primary_domain,
        similarity: 1.0,
      }),
    )
  }

  private buildQuizGenerationFn(format: string): GenerationFn {
    return async (chunks: GroundedChunk[]): Promise<ExtractiveItem> => {
      const chunkTexts = chunks.map((c) => `[Source: ${c.id}]\n${c.text}`).join('\n\n')
      const formatLabel = format.replace(/_/g, '-')

      try {
        const { object } = await this.llm.generateObject({
          taskType: 'quiz-generation',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Generate a ${formatLabel} quiz question grounded in the provided content.\n\nContent:\n${chunkTexts}`,
                },
              ],
            },
          ],
          schema: llmExtractiveItemSchema,
        })
        return object
      } catch (error) {
        if (!NoObjectGeneratedError.isInstance(error)) {
          throw error
        }
        this.logger.warn(`malformed quiz content: error=${error.message}`)
        throw new UnprocessableEntityException('LLM returned malformed quiz content')
      }
    }
  }

  private buildExplanationGenerationFn(originalItem: ExtractiveItem): GenerationFn {
    return async (chunks: GroundedChunk[]): Promise<ExtractiveItem> => {
      const chunkTexts = chunks.map((c) => `[Source: ${c.id}]\n${c.text}`).join('\n\n')

      try {
        const { object } = await this.llm.generateObject({
          taskType: 'material-generation',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Generate an explanation for why "${originalItem.correctAnswer}" is the correct answer to: "${originalItem.question}". The explanation must be grounded in the provided content.\n\nContent:\n${chunkTexts}`,
                },
              ],
            },
          ],
          schema: llmExtractiveItemSchema,
        })
        return object
      } catch (error) {
        if (!NoObjectGeneratedError.isInstance(error)) {
          throw error
        }
        this.logger.warn(`malformed explanation content: error=${error.message}`)
        throw new UnprocessableEntityException('LLM returned malformed explanation content')
      }
    }
  }
}
