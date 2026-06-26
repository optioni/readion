import { EntityManager } from '@mikro-orm/core'
import { Injectable, NotFoundException } from '@nestjs/common'
import { MockExam } from '@readion/db'
import type { ExtractiveItem, MockExamQuestion, Provenance } from '@readion/shared'
import { v4 } from 'uuid'
import type { VerifiedPayload } from '../llm/llm-response-cache.service'
import { LlmResponseCacheService } from '../llm/llm-response-cache.service'
import { QuizService } from '../quiz/quiz.service'
import type { MockDomainSlot } from './mock-exam-slot-planner'
import { planMockSlots } from './mock-exam-slot-planner'

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
   * worker processor's responsibility. This service only fills the question set.
   *
   * Returns shortfall: the number of pending slots that could not produce a
   * verified question. The processor uses this to stamp the deadline even when
   * a domain has insufficient content — the attempt is not stranded in
   * "preparing" just because some slots yielded no question.
   */
  async generateQuestionsForAttempt(attemptId: string): Promise<{ shortfall: number }> {
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

    const slots = planMockSlots(cert.domains, cert.questionCount)

    const pendingSlots = this.filterPendingSlots(slots, attempt.questions)

    const usedSourceChunkIds = new Set<string>(
      attempt.questions.flatMap((q) => q.provenance.sourceChunkIds),
    )

    let shortfall = 0

    for (const slot of pendingSlots) {
      const genResult = await this.quiz.generate(
        userId,
        {
          userCertificationId: enrollment.id,
          domain: slot.domain,
          difficulty: slot.difficulty,
        },
        { excludeChunkIds: Array.from(usedSourceChunkIds) },
      )

      if (genResult.type === 'insufficient_material') {
        shortfall++
        continue
      }

      const questionId = genResult.data.id
      const cached = await this.cache.get(questionId)
      if (!cached) {
        shortfall++
        continue
      }

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

      for (const id of genResult.data.provenance.sourceChunkIds) {
        usedSourceChunkIds.add(id)
      }

      attempt.questions = [...attempt.questions, question]
      await em.flush()
    }

    return { shortfall }
  }

  /**
   * Returns only the slots not yet satisfied by existing questions so that
   * re-invoking the job on a partially-generated attempt resumes without
   * duplicating questions already persisted to the array.
   */
  private filterPendingSlots(slots: MockDomainSlot[], existing: MockExamQuestion[]): MockDomainSlot[] {
    const existingByDomain = new Map<string, number>()
    for (const q of existing) {
      existingByDomain.set(q.domain, (existingByDomain.get(q.domain) ?? 0) + 1)
    }

    const pending: MockDomainSlot[] = []
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

  private parseCachePayload(cached: VerifiedPayload): {
    item: ExtractiveItem
    provenance: Provenance
  } {
    return JSON.parse(cached.text) as { item: ExtractiveItem; provenance: Provenance }
  }
}
