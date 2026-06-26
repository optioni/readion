import { EntityManager } from '@mikro-orm/core'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { OnEvent } from '@nestjs/event-emitter'
import { ReviewItem, UserCertification } from '@readion/db'
import type { QuizAnsweredEvent } from '@readion/shared'
import { LEITNER_INTERVALS_DAYS_DEFAULT, QUIZ_ANSWERED_EVENT } from '@readion/shared'
import type { EnvConfig } from '../config/env.schema'
import { applyLeitner, type LeitnerAnswer, nextDueAt } from './leitner'
import { reviewQualifies } from './review-qualifies'

@Injectable()
export class ReviewAccrualService {
  constructor(
    private readonly em: EntityManager,
    private readonly config: ConfigService<EnvConfig>,
  ) {}

  @OnEvent(QUIZ_ANSWERED_EVENT)
  async onQuizAnswered(event: QuizAnsweredEvent): Promise<void> {
    const anchorChunkId = event.sourceChunkIds[0]
    if (anchorChunkId === undefined) return

    const em = this.em.fork()
    const answer: LeitnerAnswer = { correct: event.correct, confidence: event.confidence }
    const intervals = this.intervals()
    const now = new Date()

    const existing = await em.findOne(ReviewItem, {
      userCertification: event.userCertificationId,
      anchorChunkId,
    })

    if (existing !== null) {
      if (existing.state === 'suppressed') return

      const fromBox = existing.state === 'mastered' ? 1 : existing.box
      if (existing.state === 'mastered' && !reviewQualifies(answer)) return

      const outcome = applyLeitner({ box: fromBox, state: 'active' }, answer, intervals)
      existing.box = outcome.box
      existing.state = outcome.state
      existing.lastReviewedAt = now
      if (outcome.dueInDays !== null) {
        existing.dueAt = nextDueAt(now, outcome.dueInDays)
      }
      await em.flush()
      return
    }

    if (!reviewQualifies(answer)) return

    const outcome = applyLeitner({ box: 1, state: 'active' }, answer, intervals)
    const item = em.create(ReviewItem, {
      userCertification: em.getReference(UserCertification, event.userCertificationId),
      anchorChunkId,
      box: outcome.box,
      state: outcome.state,
      dueAt: nextDueAt(now, outcome.dueInDays ?? intervals[0]!),
      lastReviewedAt: now,
    })
    em.persist(item)
    await em.flush()
  }

  private intervals(): number[] {
    return this.config.get('REVIEW_LEITNER_INTERVALS_DAYS') ?? [...LEITNER_INTERVALS_DAYS_DEFAULT]
  }
}

