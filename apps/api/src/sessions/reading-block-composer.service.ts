import { EntityManager } from '@mikro-orm/core'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
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
  markdown: z.string(),
  tldr: z.array(z.string()),
  supportingSpans: z.array(z.string()).optional().default([]),
})

const VERBATIM_CAP = 200

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
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

    const chunkTexts = chunks
      .map((c) => `[Source: ${c.id}]\n${c.text.slice(0, this.verbatimCap)}`)
      .join('\n\n')

    const result = await this.llm.generateText({
      taskType: 'material-generation',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Expand on this material with a detailed explanation. Return JSON: {"markdown":"...","tldr":["..."]}\n\nOriginal:\n${input.originalContent}\n\nSource content:\n${chunkTexts}`,
            },
          ],
        },
      ],
    })

    try {
      const parsed = readingBlockSchema.parse(JSON.parse(result.text))
      return parsed.markdown
    } catch (error) {
      this.logger.warn(
        `goDeeper fell back to raw LLM text: error=${errorMessage(error)} textPreview=${JSON.stringify(result.text.slice(0, 300))}`,
      )
      return result.text
    }
  }

  private async generateBlock(
    chunks: GroundedChunk[],
    domain: string,
    difficulty: string,
  ): Promise<{ markdown: string; tldr: string[]; supportingSpans: string[] }> {
    const chunkTexts = chunks
      .map((c) => `[Source: ${c.id}]\n${c.text.slice(0, this.verbatimCap)}`)
      .join('\n\n')

    const result = await this.llm.generateText({
      taskType: 'material-generation',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Create a concise study reading block about "${domain}" at ${difficulty} level.
Return JSON: {"markdown":"<Markdown prose with headings>","tldr":["<3-5 bullet points>"],"supportingSpans":["<key quoted phrases from source>"]}
Use only information from the provided sources. Do not exceed 400 words.

Source content:
${chunkTexts}`,
            },
          ],
        },
      ],
    })

    try {
      return readingBlockSchema.parse(JSON.parse(result.text))
    } catch (error) {
      this.logger.warn(
        `reading block fell back to raw LLM text: domain=${JSON.stringify(domain)} difficulty=${difficulty} error=${errorMessage(error)} textPreview=${JSON.stringify(result.text.slice(0, 300))}`,
      )
      return { markdown: result.text, tldr: [], supportingSpans: [] }
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
