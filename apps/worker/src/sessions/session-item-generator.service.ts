import { EntityManager } from '@mikro-orm/core'
import { Injectable, Logger } from '@nestjs/common'
import { SessionItem, StudySession } from '@readion/db'
import type { SessionItemPlan } from '@readion/shared'
import { NoObjectGeneratedError } from 'ai'
import { z } from 'zod'
import { LlmService } from '../llm/llm.service'

const readingBlockSchema = z.object({
  markdown: z
    .string()
    .describe('Markdown prose with headings, drawn only from the sources, at most 400 words'),
  tldr: z.array(z.string()).describe('3-5 bullet-point takeaways'),
  supportingSpans: z
    .array(z.string())
    .optional()
    .default([])
    .describe('verbatim quotes from the sources that back the prose'),
})

const quizItemSchema = z.object({
  question: z.string().describe('the question stem, answerable from the provided content alone'),
  options: z.array(z.string()).describe('3-5 answer choices, exactly one correct'),
  correctAnswer: z.string().describe('must equal one of options verbatim'),
  supportingSpans: z
    .array(z.string())
    .describe('verbatim quotes from the provided content that justify the correct answer'),
  sourceChunkIds: z.array(z.string()).describe('the id attribute of each <source> element used'),
})

type ChunkRow = { id: string; text: string; primary_domain: string }

const VERBATIM_CAP = 200

function sourcesXml(chunks: ChunkRow[], cap?: number): string {
  const sources = chunks
    .map((c) => `<source id="${c.id}">${cap ? c.text.slice(0, cap) : c.text}</source>`)
    .join('\n')
  return `<sources>\n${sources}\n</sources>`
}

@Injectable()
export class SessionItemGeneratorService {
  private readonly logger = new Logger(SessionItemGeneratorService.name)

  constructor(
    private readonly em: EntityManager,
    private readonly llm: LlmService,
  ) {}

  async generateItems(
    sessionId: string,
    items: SessionItemPlan[],
    certificationId: string,
    difficulty: string,
    contentMix: string,
  ): Promise<void> {
    const em = this.em.fork()

    for (const itemPlan of items) {
      try {
        if (itemPlan.type === 'reading') {
          await this.generateReadingItem(
            em,
            sessionId,
            itemPlan,
            certificationId,
            difficulty,
            contentMix,
          )
        } else {
          await this.generateQuizItem(em, sessionId, itemPlan, certificationId, difficulty)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        this.logger.warn(
          `Failed to generate item ${itemPlan.index} for session ${sessionId}: ${msg}`,
        )
        this.persistFallback(em, sessionId, itemPlan)
      }
    }

    await em.flush()
  }

  private async generateReadingItem(
    em: EntityManager,
    sessionId: string,
    itemPlan: SessionItemPlan,
    certificationId: string,
    difficulty: string,
    contentMix: string,
  ): Promise<void> {
    const preferVideo = contentMix === 'video-based'
    let chunks = await this.searchChunks(
      em,
      certificationId,
      itemPlan.domain,
      preferVideo ? 'video' : undefined,
    )

    if (chunks.length === 0 && preferVideo) {
      chunks = await this.searchChunks(em, certificationId, itemPlan.domain)
    }

    if (chunks.length === 0) {
      throw new Error('No content chunks found')
    }

    const chunkTexts = sourcesXml(chunks, VERBATIM_CAP)
    const prompt = `Create a concise study reading block about "${itemPlan.domain}" at ${difficulty} level.\nUse only the content in <sources>. Do not exceed 400 words.\n\n${chunkTexts}`

    try {
      const parsed = await this.llm.generateStructured(prompt, readingBlockSchema)
      em.persist(
        em.create(SessionItem, {
          session: em.getReference(StudySession, sessionId),
          index: itemPlan.index,
          type: 'reading',
          domain: itemPlan.domain,
          content: parsed.markdown,
          completed: false,
          sourceChunkIds: chunks.map((c) => c.id),
          supportingSpans: parsed.supportingSpans,
        }),
      )
    } catch (error) {
      if (!NoObjectGeneratedError.isInstance(error)) {
        throw error
      }
      this.logger.warn(
        `reading block fell back to raw LLM text: session=${sessionId} index=${itemPlan.index} domain=${JSON.stringify(itemPlan.domain)} error=${error.message} textPreview=${JSON.stringify((error.text ?? '').slice(0, 300))}`,
      )
      em.persist(
        em.create(SessionItem, {
          session: em.getReference(StudySession, sessionId),
          index: itemPlan.index,
          type: 'reading',
          domain: itemPlan.domain,
          content: error.text ?? '',
          completed: false,
          sourceChunkIds: chunks.map((c) => c.id),
          supportingSpans: [],
        }),
      )
    }
  }

  private async generateQuizItem(
    em: EntityManager,
    sessionId: string,
    itemPlan: SessionItemPlan,
    certificationId: string,
    difficulty: string,
  ): Promise<void> {
    const chunks =
      itemPlan.anchorChunkId !== undefined
        ? await this.loadChunksByIds(em, [itemPlan.anchorChunkId])
        : await this.searchChunks(em, certificationId, itemPlan.domain)
    if (chunks.length === 0) {
      throw new Error('No content chunks found')
    }

    const format = itemPlan.format ?? 'multiple_choice'
    const formatLabel = format.replace(/_/g, '-')
    const chunkTexts = sourcesXml(chunks)
    const prompt = `Generate a ${formatLabel} quiz question at ${difficulty} level using only the content in <sources>. Do not use outside knowledge.\n\n${chunkTexts}`

    try {
      const parsed = await this.llm.generateStructured(prompt, quizItemSchema)
      em.persist(
        em.create(SessionItem, {
          session: em.getReference(StudySession, sessionId),
          index: itemPlan.index,
          type: 'quiz',
          domain: itemPlan.domain,
          content: JSON.stringify({ question: parsed.question, options: parsed.options, format }),
          completed: false,
          sourceChunkIds: parsed.sourceChunkIds,
          supportingSpans: parsed.supportingSpans,
        }),
      )
    } catch (error) {
      if (!NoObjectGeneratedError.isInstance(error)) {
        throw error
      }
      this.logger.warn(
        `malformed quiz content: session=${sessionId} index=${itemPlan.index} domain=${JSON.stringify(itemPlan.domain)} error=${error.message} textPreview=${JSON.stringify((error.text ?? '').slice(0, 300))}`,
      )
      throw new Error('LLM returned malformed quiz content')
    }
  }

  private persistFallback(em: EntityManager, sessionId: string, itemPlan: SessionItemPlan): void {
    const content =
      itemPlan.type === 'reading'
        ? `## ${itemPlan.domain}\n\nContent for this domain is being prepared.`
        : JSON.stringify({ insufficient: true, domain: itemPlan.domain })
    em.persist(
      em.create(SessionItem, {
        session: em.getReference(StudySession, sessionId),
        index: itemPlan.index,
        type: itemPlan.type,
        domain: itemPlan.domain,
        content,
        completed: false,
        sourceChunkIds: [],
        supportingSpans: [],
      }),
    )
  }

  private async loadChunksByIds(em: EntityManager, chunkIds: string[]): Promise<ChunkRow[]> {
    if (chunkIds.length === 0) return []
    const placeholders = chunkIds.map(() => '?').join(', ')
    return em.getConnection().execute<ChunkRow[]>(
      `SELECT id, text, primary_domain
       FROM content_chunks
       WHERE id IN (${placeholders}) AND state = 'active'`,
      chunkIds,
    )
  }

  private async searchChunks(
    em: EntityManager,
    certificationId: string,
    domain: string,
    chunkType?: string,
  ): Promise<ChunkRow[]> {
    const params: unknown[] = [certificationId, domain]
    let typeFilter = ''
    if (chunkType !== undefined) {
      typeFilter = `AND metadata->>'type' = ?`
      params.push(chunkType)
    }

    return em.getConnection().execute<ChunkRow[]>(
      `SELECT id, text, primary_domain
       FROM content_chunks
       WHERE certification_id = ?
         AND state = 'active'
         AND EXISTS (
           SELECT 1 FROM jsonb_array_elements(domain_tags) AS tag
           WHERE tag->>'domain' = ?
         )
         ${typeFilter}
       ORDER BY created_at DESC
       LIMIT 5`,
      params,
    )
  }
}
