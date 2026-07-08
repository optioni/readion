import { EntityManager } from '@mikro-orm/core'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NoObjectGeneratedError } from 'ai'
import { z } from 'zod'
import type { EnvConfig } from '../config/env.schema'
import { LlmService } from '../llm/llm.service'

type GroundedChunk = {
  id: string
  text: string
  primaryDomain: string
  similarity: number
}

export type ReadingBlockResult = {
  markdown: string
  tldr: string[]
  sourceChunkIds: string[]
  supportingSpans: string[]
} | null

export type ComposeInput = {
  domain: string
  certificationId: string
  difficulty: string
  preferVideo?: boolean
}

export type GoDeeperInput = {
  sourceChunkIds: string[]
  originalContent: string
  certificationId: string
}

export interface ReadingBlockComposer {
  compose(input: ComposeInput): Promise<ReadingBlockResult>
  goDeeper(input: GoDeeperInput): Promise<string>
}

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

const VERBATIM_CAP = 200

function sourcesXml(chunks: GroundedChunk[], cap: number): string {
  const sources = chunks
    .map((c) => `<source id="${c.id}">${c.text.slice(0, cap)}</source>`)
    .join('\n')
  return `<sources>\n${sources}\n</sources>`
}

@Injectable()
export class ReadingBlockComposerService implements ReadingBlockComposer {
  private readonly logger = new Logger(ReadingBlockComposerService.name)
  private readonly threshold: number
  private readonly verbatimCap: number

  constructor(
    private readonly llm: LlmService,
    private readonly em: EntityManager,
    private readonly config: ConfigService<EnvConfig>,
  ) {
    this.threshold = this.config.get<number>('GROUNDING_SIMILARITY_THRESHOLD') ?? 0.75
    this.verbatimCap = this.config.get<number>('GROUNDING_VERBATIM_CAP') ?? VERBATIM_CAP
  }

  async compose(input: ComposeInput): Promise<ReadingBlockResult> {
    const { domain, certificationId, difficulty, preferVideo } = input

    let chunks = await this.searchChunks(certificationId, domain, preferVideo ? 'video' : undefined)

    if (chunks.length === 0 && preferVideo) {
      chunks = await this.searchChunks(certificationId, domain)
    }

    const aboveThreshold = chunks.filter((c) => c.similarity >= this.threshold).slice(0, 3)
    if (aboveThreshold.length === 0) return null

    const result = await this.generateBlock(aboveThreshold, domain, difficulty)

    return {
      markdown: result.markdown,
      tldr: result.tldr,
      sourceChunkIds: aboveThreshold.map((c) => c.id),
      supportingSpans: result.supportingSpans,
    }
  }

  async goDeeper(input: GoDeeperInput): Promise<string> {
    const chunks = await this.loadChunksByIds(input.sourceChunkIds)
    if (chunks.length === 0) return input.originalContent

    const chunkTexts = sourcesXml(chunks, this.verbatimCap)

    try {
      const { object } = await this.llm.generateObject({
        taskType: 'material-generation',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Expand on this material with a detailed explanation, using only the content in <sources>.\n\nOriginal:\n${input.originalContent}\n\n${chunkTexts}`,
              },
            ],
          },
        ],
        schema: readingBlockSchema,
      })
      return object.markdown
    } catch (error) {
      if (!NoObjectGeneratedError.isInstance(error)) {
        throw error
      }
      this.logger.warn(
        `goDeeper fell back to raw LLM text: error=${error.message} textPreview=${JSON.stringify((error.text ?? '').slice(0, 300))}`,
      )
      return error.text ?? input.originalContent
    }
  }

  private async generateBlock(
    chunks: GroundedChunk[],
    domain: string,
    difficulty: string,
  ): Promise<{ markdown: string; tldr: string[]; supportingSpans: string[] }> {
    const chunkTexts = sourcesXml(chunks, this.verbatimCap)

    try {
      const { object } = await this.llm.generateObject({
        taskType: 'material-generation',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Create a concise study reading block about "${domain}" at ${difficulty} level.
Use only the content in <sources>. Do not exceed 400 words.

${chunkTexts}`,
              },
            ],
          },
        ],
        schema: readingBlockSchema,
      })
      return object
    } catch (error) {
      if (!NoObjectGeneratedError.isInstance(error)) {
        throw error
      }
      this.logger.warn(
        `reading block fell back to raw LLM text: domain=${JSON.stringify(domain)} difficulty=${difficulty} error=${error.message} textPreview=${JSON.stringify((error.text ?? '').slice(0, 300))}`,
      )
      return { markdown: error.text ?? '', tldr: [], supportingSpans: [] }
    }
  }

  private async searchChunks(
    certificationId: string,
    domain: string,
    chunkType?: string,
  ): Promise<GroundedChunk[]> {
    const em = this.em.fork()

    type ChunkRow = {
      id: string
      text: string
      primary_domain: string
      similarity: number
    }

    const params: unknown[] = [certificationId, domain]
    let typeFilter = ''
    if (chunkType !== undefined) {
      typeFilter = `AND metadata->>'type' = ?`
      params.push(chunkType)
    }

    const rows = await em.getConnection().execute<ChunkRow[]>(
      `SELECT id, text, primary_domain, 1.0 AS similarity
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

    return rows.map((row: ChunkRow) => ({
      id: row.id,
      text: row.text,
      primaryDomain: row.primary_domain,
      similarity: row.similarity,
    }))
  }

  private async loadChunksByIds(chunkIds: string[]): Promise<GroundedChunk[]> {
    if (chunkIds.length === 0) return []
    const em = this.em.fork()

    type ChunkRow2 = { id: string; text: string; primary_domain: string }

    const placeholders = chunkIds.map(() => '?').join(', ')
    const rows = await em
      .getConnection()
      .execute<ChunkRow2[]>(
        `SELECT id, text, primary_domain FROM content_chunks WHERE id IN (${placeholders}) AND state = 'active'`,
        chunkIds,
      )

    return rows.map((row: ChunkRow2) => ({
      id: row.id,
      text: row.text,
      primaryDomain: row.primary_domain,
      similarity: 1.0,
    }))
  }
}
