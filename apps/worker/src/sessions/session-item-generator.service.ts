import { EntityManager } from '@mikro-orm/core'
import { Injectable, Logger } from '@nestjs/common'
import { SessionItem, StudySession } from '@readion/db'
import type { SessionItemPlan } from '@readion/shared'
import { z } from 'zod'
import { LlmService } from '../llm/llm.service'

const readingBlockSchema = z.object({
  markdown: z.string(),
  tldr: z.array(z.string()),
  supportingSpans: z.array(z.string()).optional().default([]),
})

const quizItemSchema = z.object({
  question: z.string(),
  options: z.array(z.string()),
  correctAnswer: z.string(),
  supportingSpans: z.array(z.string()),
  sourceChunkIds: z.array(z.string()),
})

type ChunkRow = { id: string; text: string; primary_domain: string }

const VERBATIM_CAP = 200

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

    const chunkTexts = chunks
      .map((c) => `[Source: ${c.id}]\n${c.text.slice(0, VERBATIM_CAP)}`)
      .join('\n\n')
    const prompt = `Create a concise study reading block about "${itemPlan.domain}" at ${difficulty} level.\nReturn JSON: {"markdown":"<Markdown prose>","tldr":["<3-5 bullet points>"],"supportingSpans":["<key quoted phrases>"]}\nUse only information from the provided sources. Do not exceed 400 words.\n\nSource content:\n${chunkTexts}`

    const text = await this.llm.generateContent(prompt)

    try {
      const parsed = readingBlockSchema.parse(JSON.parse(text))
      em.persist(
        em.create(SessionItem, {
          session: em.getReference(StudySession, sessionId),
          index: itemPlan.index,
          type: 'reading',
          content: parsed.markdown,
          completed: false,
          sourceChunkIds: chunks.map((c) => c.id),
          supportingSpans: parsed.supportingSpans,
        }),
      )
    } catch {
      em.persist(
        em.create(SessionItem, {
          session: em.getReference(StudySession, sessionId),
          index: itemPlan.index,
          type: 'reading',
          content: text,
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
    const chunkTexts = chunks.map((c) => `[Source: ${c.id}]\n${c.text}`).join('\n\n')
    const prompt = `Generate a ${formatLabel} quiz question at ${difficulty} level grounded in the provided content.\nReturn JSON: {"question":"...","options":["...","...","...","..."],"correctAnswer":"...","supportingSpans":["..."],"sourceChunkIds":["..."]}\n\nContent:\n${chunkTexts}`

    const text = await this.llm.generateContent(prompt)

    try {
      const parsed = quizItemSchema.parse(JSON.parse(text))
      em.persist(
        em.create(SessionItem, {
          session: em.getReference(StudySession, sessionId),
          index: itemPlan.index,
          type: 'quiz',
          content: JSON.stringify({ question: parsed.question, options: parsed.options, format }),
          completed: false,
          sourceChunkIds: parsed.sourceChunkIds,
          supportingSpans: parsed.supportingSpans,
        }),
      )
    } catch {
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
