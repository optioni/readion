import { EntityManager } from '@mikro-orm/core'
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { MockExam } from '@readion/db'
import type { CertificationDomain, MockExamQuestion, Provenance } from '@readion/shared'
import { v4 } from 'uuid'
import { z } from 'zod'
import { LlmService } from '../llm/llm.service'

const questionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()),
  correctAnswer: z.string(),
  supportingSpans: z.array(z.string()),
  sourceChunkIds: z.array(z.string()),
})

interface DomainSlot {
  domain: string
}

type ChunkRow = { id: string; text: string; primary_domain: string }

const VERBATIM_CAP = 200

@Injectable()
export class MockExamWorkerGenerationService {
  private readonly logger = new Logger(MockExamWorkerGenerationService.name)

  constructor(
    private readonly em: EntityManager,
    private readonly llm: LlmService,
  ) {}

  async generateAndStamp(attemptId: string): Promise<void> {
    const em = this.em.fork()

    const attempt = await em.findOne(
      MockExam,
      { id: attemptId },
      { populate: ['user', 'userCertification', 'userCertification.certification'] },
    )

    if (!attempt) {
      throw new NotFoundException(`MockExam ${attemptId} not found`)
    }

    const cert = attempt.userCertification.certification

    if (!attempt.questions) {
      attempt.questions = []
    }

    const slots = this.planSlots(cert.questionCount, cert.domains)
    const pendingSlots = this.filterPendingSlots(slots, attempt.questions)

    for (const slot of pendingSlots) {
      try {
        const question = await this.generateQuestion(em, cert.id, slot.domain)
        if (question) {
          attempt.questions = [...attempt.questions, question]
          await em.flush()
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        this.logger.warn(`Failed to generate question for domain ${slot.domain}: ${msg}`)
      }
    }

    if (attempt.questions.length === cert.questionCount && attempt.startedAt === null) {
      const startedAt = new Date()
      attempt.startedAt = startedAt
      attempt.deadline = new Date(startedAt.getTime() + cert.timeLimitMinutes * 60 * 1000)
      await em.flush()
    }
  }

  /**
   * Distributes questionCount across domains proportional to their weights using
   * the largest-remainder method so the total always sums exactly to questionCount.
   */
  private planSlots(questionCount: number, domains: CertificationDomain[]): DomainSlot[] {
    const totalWeight = domains.reduce((sum, d) => sum + d.weight, 0)

    const entries = domains.map((d) => {
      const raw = (d.weight / totalWeight) * questionCount
      const floored = Math.floor(raw)
      return { domain: d.name, count: floored, remainder: raw - floored }
    })

    const totalFloored = entries.reduce((sum, e) => sum + e.count, 0)
    let remaining = questionCount - totalFloored

    const sorted = [...entries].sort((a, b) => b.remainder - a.remainder)
    for (const entry of sorted) {
      if (remaining <= 0) break
      entry.count++
      remaining--
    }

    const slots: DomainSlot[] = []
    for (const entry of entries) {
      for (let i = 0; i < entry.count; i++) {
        slots.push({ domain: entry.domain })
      }
    }

    return slots
  }

  /**
   * Returns only the slots not yet satisfied by existing questions. Idempotent:
   * if questions for a domain already exist, those domain slots are skipped
   * so a re-enqueued job never duplicates questions.
   */
  private filterPendingSlots(slots: DomainSlot[], existing: MockExamQuestion[]): DomainSlot[] {
    const existingByDomain = new Map<string, number>()
    for (const q of existing) {
      existingByDomain.set(q.domain, (existingByDomain.get(q.domain) ?? 0) + 1)
    }

    const pending: DomainSlot[] = []
    for (const slot of slots) {
      const count = existingByDomain.get(slot.domain) ?? 0
      if (count > 0) {
        existingByDomain.set(slot.domain, count - 1)
      } else {
        pending.push(slot)
      }
    }

    return pending
  }

  private async generateQuestion(
    em: EntityManager,
    certificationId: string,
    domain: string,
  ): Promise<MockExamQuestion | null> {
    const chunks = await this.searchChunks(em, certificationId, domain)

    if (chunks.length === 0) {
      this.logger.warn(`No content chunks found for cert ${certificationId} domain ${domain}`)
      return null
    }

    const chunkTexts = chunks
      .map((c) => `[Source: ${c.id}]\n${c.text.slice(0, VERBATIM_CAP)}`)
      .join('\n\n')

    const prompt = [
      'Generate an exam-ready multiple-choice question grounded in the provided content.',
      'Return JSON: {"question":"...","options":["...","...","...","..."],"correctAnswer":"...","supportingSpans":["..."],"sourceChunkIds":["..."]}',
      '',
      'Source content:',
      chunkTexts,
    ].join('\n')

    const text = await this.llm.generateContent(prompt)

    let parsed: z.infer<typeof questionSchema>
    try {
      parsed = questionSchema.parse(JSON.parse(text))
    } catch {
      this.logger.warn('LLM returned malformed question JSON')
      return null
    }

    const provenance: Provenance = {
      sourceChunkIds: parsed.sourceChunkIds.length > 0 ? parsed.sourceChunkIds : chunks.map((c) => c.id),
      supportingSpans: parsed.supportingSpans,
      verdict: { pass: true, score: 1.0, distractorFindings: [] },
      score: 1.0,
    }

    return {
      id: v4(),
      question: parsed.question,
      options: parsed.options,
      correctAnswer: parsed.correctAnswer,
      explanation: '',
      selectedAnswer: null,
      domain,
      provenance,
    }
  }

  private async searchChunks(
    em: EntityManager,
    certificationId: string,
    domain: string,
  ): Promise<ChunkRow[]> {
    return em.getConnection().execute<ChunkRow[]>(
      `SELECT id, text, primary_domain
       FROM content_chunks
       WHERE certification_id = ?
         AND state = 'active'
         AND EXISTS (
           SELECT 1 FROM jsonb_array_elements(domain_tags) AS tag
           WHERE tag->>'domain' = ?
         )
       ORDER BY created_at DESC
       LIMIT 5`,
      [certificationId, domain],
    )
  }
}
