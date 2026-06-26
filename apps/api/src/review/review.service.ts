import { EntityManager } from '@mikro-orm/core'
import { Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ContentChunk, ReviewItem, UserCertification } from '@readion/db'
import type {
  ReviewItemResponse,
  ReviewItemState,
  ReviewQueueMeta,
  StartReviewResponse,
} from '@readion/shared'
import { REVIEW_SESSION_QUESTION_CAP_DEFAULT } from '@readion/shared'
import type { EnvConfig } from '../config/env.schema'
import { SessionsService } from '../sessions/sessions.service'
import { ReviewQueueService } from './review-queue.service'

type ReviewQueueRow = {
  id: string
  user_certification_id: string
  anchor_chunk_id: string
  domain: string | null
  box: number
  state: ReviewItemState
  due_at: string
  last_reviewed_at: string | null
}

@Injectable()
export class ReviewService {
  constructor(
    private readonly em: EntityManager,
    private readonly queue: ReviewQueueService,
    private readonly sessions: SessionsService,
    private readonly config: ConfigService<EnvConfig>,
  ) {}

  async getQueue(
    userId: string,
    enrollmentId: string,
  ): Promise<{ items: ReviewItemResponse[]; meta: ReviewQueueMeta }> {
    const em = this.em.fork()
    await this.requireEnrollment(em, userId, enrollmentId)

    const dueRows = await em.getConnection().execute<ReviewQueueRow[]>(
      `SELECT r.id, r.user_certification_id, r.anchor_chunk_id, c.primary_domain AS domain,
              r.box, r.state, r.due_at, r.last_reviewed_at
       FROM review_items r
       LEFT JOIN content_chunks c ON c.id = r.anchor_chunk_id
       WHERE r.user_certification_id = ? AND r.state = 'active' AND r.due_at <= now()
       ORDER BY r.due_at ASC`,
      [enrollmentId],
    )

    const totalRows = await em.getConnection().execute<{ count: string }[]>(
      `SELECT COUNT(*) AS count FROM review_items
       WHERE user_certification_id = ? AND state = 'active'`,
      [enrollmentId],
    )
    const total = Number.parseInt(totalRows[0]!.count, 10)

    const items = dueRows.map(mapRowToDto)
    return { items, meta: { dueCount: items.length, total } }
  }

  async masterItem(userId: string, reviewItemId: string): Promise<ReviewItemResponse> {
    const em = this.em.fork()

    const item = await em.findOne(
      ReviewItem,
      { id: reviewItemId, userCertification: { user: userId } },
      { populate: ['userCertification'] },
    )
    if (item === null) {
      throw new NotFoundException('Review item not found')
    }

    item.state = 'suppressed'
    await em.flush()

    const chunk = await em.findOne(ContentChunk, { id: item.anchorChunkId })
    return {
      id: item.id,
      userCertificationId: item.userCertification.id,
      anchorChunkId: item.anchorChunkId,
      domain: chunk?.primaryDomain ?? '',
      box: item.box,
      state: item.state,
      dueAt: item.dueAt.toISOString(),
      lastReviewedAt: item.lastReviewedAt ? item.lastReviewedAt.toISOString() : null,
    }
  }

  async suppressDomain(
    userId: string,
    enrollmentId: string,
    domain: string,
  ): Promise<{ suppressedCount: number }> {
    const em = this.em.fork()
    await this.requireEnrollment(em, userId, enrollmentId)

    const result = await em.getConnection().execute<{ id: string }[]>(
      `UPDATE review_items r
       SET state = 'suppressed', updated_at = now()
       FROM content_chunks c
       WHERE c.id = r.anchor_chunk_id
         AND r.user_certification_id = ?
         AND r.state != 'suppressed'
         AND c.primary_domain = ?
       RETURNING r.id`,
      [enrollmentId, domain],
    )

    return { suppressedCount: result.length }
  }

  async startReview(userId: string, enrollmentId: string): Promise<StartReviewResponse> {
    const em = this.em.fork()
    await this.requireEnrollment(em, userId, enrollmentId)

    const cap =
      this.config.get('REVIEW_SESSION_QUESTION_CAP') ?? REVIEW_SESSION_QUESTION_CAP_DEFAULT
    const concepts = await this.queue.getDueConcepts(em, enrollmentId, new Date(), cap)
    await em.flush()

    if (concepts.length === 0) {
      return { status: 'all_caught_up' }
    }

    const { session } = await this.sessions.createReviewSession(
      userId,
      enrollmentId,
      concepts.map((c) => ({ domain: c.domain, anchorChunkId: c.anchorChunkId })),
    )

    return { status: 'started', session }
  }

  private async requireEnrollment(
    em: EntityManager,
    userId: string,
    enrollmentId: string,
  ): Promise<void> {
    const enrollment = await em.findOne(UserCertification, { id: enrollmentId, user: userId })
    if (enrollment === null) {
      throw new NotFoundException('Enrollment not found')
    }
  }
}

function mapRowToDto(row: ReviewQueueRow): ReviewItemResponse {
  return {
    id: row.id,
    userCertificationId: row.user_certification_id,
    anchorChunkId: row.anchor_chunk_id,
    domain: row.domain ?? '',
    box: row.box,
    state: row.state,
    dueAt: new Date(row.due_at).toISOString(),
    lastReviewedAt: row.last_reviewed_at ? new Date(row.last_reviewed_at).toISOString() : null,
  }
}
