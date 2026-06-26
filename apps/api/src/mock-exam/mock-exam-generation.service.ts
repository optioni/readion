import { EntityManager } from '@mikro-orm/core'
import { Injectable, NotFoundException } from '@nestjs/common'
import { MockExam } from '@readion/db'
import type { CertificationDomain, ExtractiveItem, MockExamQuestion, Provenance } from '@readion/shared'
import { v4 } from 'uuid'
import type { VerifiedPayload } from '../llm/llm-response-cache.service'
import { LlmResponseCacheService } from '../llm/llm-response-cache.service'
import { QuizService } from '../quiz/quiz.service'

interface DomainSlot {
  domain: string
  difficulty: 'exam-ready'
}

/**
 * Domain allocation uses the largest-remainder (Hamilton's) method:
 * each domain receives floor(weight/totalWeight * questionCount) questions,
 * then the remaining slots are given one-by-one to the domains with the
 * largest fractional remainders. This ensures the sum always equals
 * questionCount with no rounding divergence.
 *
 * Difficulty is fixed at 'exam-ready' for all slots since mock exams
 * simulate real examination conditions.
 */
@Injectable()
export class MockExamGenerationService {
  constructor(
    private readonly em: EntityManager,
    private readonly quiz: QuizService,
    private readonly cache: LlmResponseCacheService,
  ) {}

  /**
   * Generates and persists the full verified question set for an attempt.
   *
   * Each question is persisted to the attempt's `questions` JSONB array
   * immediately after it passes the grounding + verifier guarantee, so a
   * concurrent GET can observe incremental fill progress.
   *
   * startedAt and deadline are intentionally NOT stamped here — that is the
   * worker processor's responsibility (Group 4). This service only fills the
   * question set.
   */
  async generateQuestionsForAttempt(attemptId: string): Promise<void> {
    const em = this.em.fork()

    const attempt = await em.findOne(
      MockExam,
      { id: attemptId },
      { populate: ['user', 'userCertification', 'userCertification.certification'] },
    )

    if (!attempt) {
      throw new NotFoundException(`MockExam ${attemptId} not found`)
    }

    const enrollment = attempt.userCertification
    const cert = enrollment.certification
    const userId = attempt.user.id

    const slots = this.planSlots(cert.questionCount, cert.domains)

    if (!attempt.questions) {
      attempt.questions = []
    }

    for (const slot of slots) {
      const genResult = await this.quiz.generate(userId, {
        userCertificationId: enrollment.id,
        domain: slot.domain,
        difficulty: slot.difficulty,
      })

      if (genResult.type === 'insufficient_material') {
        continue
      }

      const questionId = genResult.data.id
      const cached = await this.cache.get(questionId)
      if (!cached) continue

      const payload = this.parseCachePayload(cached)
      const explanation = await this.generateExplanation(userId, questionId, enrollment.id)

      const question: MockExamQuestion = {
        id: v4(),
        question: genResult.data.question,
        options: genResult.data.options,
        correctAnswer: payload.item.correctAnswer,
        explanation,
        selectedAnswer: null,
        domain: slot.domain,
        provenance: genResult.data.provenance,
      }

      attempt.questions = [...attempt.questions, question]
      await em.flush()
    }
  }

  /**
   * Distributes questionCount across domains proportional to their weights
   * using the largest-remainder method so the total always sums exactly to
   * questionCount.
   */
  planSlots(questionCount: number, domains: CertificationDomain[]): DomainSlot[] {
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
        slots.push({ domain: entry.domain, difficulty: 'exam-ready' })
      }
    }

    return slots
  }

  private async generateExplanation(
    userId: string,
    questionId: string,
    userCertificationId: string,
  ): Promise<string> {
    try {
      const result = await this.quiz.generateExplanation(userId, questionId, {
        userCertificationId,
      })
      return result.explanation
    } catch {
      return ''
    }
  }

  private parseCachePayload(cached: VerifiedPayload): { item: ExtractiveItem; provenance: Provenance } {
    return JSON.parse(cached.text) as { item: ExtractiveItem; provenance: Provenance }
  }
}
