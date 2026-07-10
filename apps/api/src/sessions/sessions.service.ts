import { EntityManager, UniqueConstraintViolationException } from '@mikro-orm/core'
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common'
import { SessionItem, StudySession, User, UserCertification } from '@readion/db'
import type {
  CreateSessionRequest,
  SessionContentMix,
  SessionDifficulty,
  SessionFocusArea,
  SessionItemResponse,
  SessionLearningStyle,
  SessionResponse,
  SessionWithItemsResponse,
} from '@readion/shared'
import type { CollectionResult } from '../common/interceptors/response.interceptor'
import { QuizService } from '../quiz/quiz.service'
import { WeakAreasService } from '../weak-areas/weak-areas.service'
import { DUE_ITEMS_PROVIDER, type DueItemsProvider } from './due-items.port'
import { ReadingBlockComposerService } from './reading-block-composer.service'
import { SessionFillQueueService } from './session-fill-queue.service'
import type { ItemPlan, SavedSessionConfig } from './session-planner'
import {
  buildItemPlan,
  frontLoadReviewItems,
  resolveSessionConfig,
  resolveTargetDomains,
} from './session-planner'

const SYNC_ITEM_COUNT = 3

export type SessionListFilters = {
  certificationId?: string
  status?: string
  page?: number
  limit?: number
}

export type ReviewTarget = { domain: string; anchorChunkId: string }

@Injectable()
export class SessionsService {
  constructor(
    private readonly em: EntityManager,
    private readonly weakAreas: WeakAreasService,
    private readonly composer: ReadingBlockComposerService,
    private readonly quiz: QuizService,
    private readonly fillQueue: SessionFillQueueService,
    @Optional()
    @Inject(DUE_ITEMS_PROVIDER)
    private readonly dueItems: DueItemsProvider | null = null,
  ) {}

  async create(
    userId: string,
    enrollmentId: string,
    request: CreateSessionRequest,
  ): Promise<{ session: SessionResponse; statusCode: 200 | 201 }> {
    const em = this.em.fork()

    const enrollment = await em.findOne(
      UserCertification,
      { id: enrollmentId, user: userId },
      { populate: ['certification'] },
    )
    if (enrollment === null) {
      throw new NotFoundException('Enrollment not found')
    }

    const existing = await em.findOne(StudySession, {
      userCertification: enrollmentId,
      status: 'active',
    })

    if (existing !== null) {
      return { session: mapSessionToDto(existing), statusCode: 200 }
    }

    const savedConfig = resolveSavedConfig(enrollment)
    const config = resolveSessionConfig(request, savedConfig)

    const weakAreaList = await this.weakAreas.listForEnrollment(userId, enrollmentId)
    const certDomains = enrollment.certification.domains.map((d) => d.name)
    const targetDomains = resolveTargetDomains(config.focusArea, weakAreaList, certDomains)

    let itemPlan = buildItemPlan({
      durationMinutes: config.durationMinutes,
      contentMix: config.contentMix,
      difficulty: config.difficulty,
      targetDomains,
      certificationId: enrollment.certification.id,
    })

    if (config.learningStyle === 'spaced-repetition' && this.dueItems !== null) {
      const dueTargets = await this.dueItems.getDueTargets(userId, enrollmentId)
      itemPlan = frontLoadReviewItems(itemPlan, dueTargets)
    }

    const session = em.create(StudySession, {
      userCertification: enrollment,
      user: em.getReference(User, userId),
      kind: 'study',
      status: 'active',
      durationMinutes: config.durationMinutes,
      contentMix: config.contentMix,
      difficulty: config.difficulty,
      focusArea: config.focusArea,
      learningStyle: config.learningStyle,
      lastItemIndex: 0,
      startedAt: new Date(),
      endedAt: null,
    })

    try {
      em.persist(session)
      await em.flush()
    } catch (e) {
      if (e instanceof UniqueConstraintViolationException) {
        const active = await em.findOne(StudySession, {
          userCertification: enrollmentId,
          status: 'active',
        })
        if (active !== null) {
          return { session: mapSessionToDto(active), statusCode: 200 }
        }
      }
      throw e
    }

    const syncItems = itemPlan.slice(0, SYNC_ITEM_COUNT)
    await this.generateItems(
      userId,
      session.id,
      syncItems,
      enrollment.certification.id,
      enrollment.id,
      config.difficulty,
      config.contentMix,
    )

    if (itemPlan.length > SYNC_ITEM_COUNT) {
      const remainingItems = itemPlan.slice(SYNC_ITEM_COUNT)
      await this.fillQueue.enqueueSessionFill(
        session.id,
        SYNC_ITEM_COUNT,
        remainingItems,
        enrollment.certification.id,
        enrollment.id,
        config.difficulty,
        config.contentMix,
      )
    }

    return { session: mapSessionToDto(session), statusCode: 201 }
  }

  async createReviewSession(
    userId: string,
    enrollmentId: string,
    targets: ReviewTarget[],
  ): Promise<{ session: SessionResponse; statusCode: 200 | 201 }> {
    const em = this.em.fork()

    const enrollment = await em.findOne(
      UserCertification,
      { id: enrollmentId, user: userId },
      { populate: ['certification'] },
    )
    if (enrollment === null) {
      throw new NotFoundException('Enrollment not found')
    }

    const existing = await em.findOne(StudySession, {
      userCertification: enrollmentId,
      status: 'active',
    })
    if (existing !== null) {
      return { session: mapSessionToDto(existing), statusCode: 200 }
    }

    const difficulty: SessionDifficulty =
      (enrollment.sessionOverrideDifficulty as SessionDifficulty | null) ?? 'intermediate'

    const session = em.create(StudySession, {
      userCertification: enrollment,
      user: em.getReference(User, userId),
      kind: 'review',
      status: 'active',
      durationMinutes: 5,
      contentMix: 'quiz-heavy',
      difficulty,
      focusArea: { mode: 'auto' },
      learningStyle: 'spaced-repetition',
      lastItemIndex: 0,
      startedAt: new Date(),
      endedAt: null,
    })

    try {
      em.persist(session)
      await em.flush()
    } catch (e) {
      if (e instanceof UniqueConstraintViolationException) {
        const active = await em.findOne(StudySession, {
          userCertification: enrollmentId,
          status: 'active',
        })
        if (active !== null) {
          return { session: mapSessionToDto(active), statusCode: 200 }
        }
      }
      throw e
    }

    const itemPlan: ItemPlan[] = targets.map((target, index) => ({
      index,
      type: 'quiz',
      domain: target.domain,
      anchorChunkId: target.anchorChunkId,
    }))

    await this.generateItems(
      userId,
      session.id,
      itemPlan,
      enrollment.certification.id,
      enrollment.id,
      difficulty,
      'quiz-heavy',
    )

    return { session: mapSessionToDto(session), statusCode: 201 }
  }

  async findOne(
    userId: string,
    sessionId: string,
    includeItems = false,
  ): Promise<SessionWithItemsResponse> {
    const em = this.em.fork()

    const session = await em.findOne(StudySession, { id: sessionId, user: userId })
    if (session === null) {
      throw new NotFoundException('Session not found')
    }

    const dto = mapSessionToDto(session) as SessionWithItemsResponse

    if (includeItems) {
      const items = await em.find(
        SessionItem,
        { session: sessionId },
        { orderBy: { index: 'ASC' } },
      )
      dto.items = items.map(mapItemToDto)
    }

    return dto
  }

  async completeItem(
    userId: string,
    sessionId: string,
    itemIndex: number,
  ): Promise<SessionResponse> {
    const em = this.em.fork()

    const session = await em.findOne(StudySession, { id: sessionId, user: userId })
    if (session === null) {
      throw new NotFoundException('Session not found')
    }

    if (session.status !== 'active') {
      throw new BadRequestException('Session is not active')
    }

    const item = await em.findOne(SessionItem, { session: sessionId, index: itemIndex })
    if (item === null) {
      throw new NotFoundException('Session item not found')
    }

    item.completed = true

    const nextIndex = await this.findNextIncompleteIndex(em, sessionId, itemIndex)
    session.lastItemIndex = nextIndex

    await em.flush()
    return mapSessionToDto(session)
  }

  async goDeeper(userId: string, sessionId: string, itemIndex: number): Promise<string> {
    const em = this.em.fork()

    const session = await em.findOne(StudySession, { id: sessionId, user: userId })
    if (session === null) {
      throw new NotFoundException('Session not found')
    }

    if (session.status !== 'active') {
      throw new BadRequestException('Session is not active')
    }

    const item = await em.findOne(SessionItem, { session: sessionId, index: itemIndex })
    if (item === null || item.type !== 'reading') {
      throw new NotFoundException('Reading item not found')
    }

    return this.composer.goDeeper({
      sourceChunkIds: item.sourceChunkIds,
      originalContent: item.content,
      certificationId: session.userCertification.id,
    })
  }

  async end(userId: string, sessionId: string): Promise<SessionResponse> {
    const em = this.em.fork()

    const session = await em.findOne(
      StudySession,
      { id: sessionId, user: userId },
      { populate: ['userCertification'] },
    )
    if (session === null) {
      throw new NotFoundException('Session not found')
    }

    if (session.status !== 'active') {
      return mapSessionToDto(session)
    }

    const items = await em.find(SessionItem, { session: sessionId })
    const allCompleted = items.length > 0 && items.every((i) => i.completed)
    const anyCompleted = items.some((i) => i.completed)

    session.status = allCompleted ? 'completed' : anyCompleted ? 'partial' : 'abandoned'
    session.endedAt = new Date()
    await em.flush()

    return mapSessionToDto(session)
  }

  async list(
    userId: string,
    filters: SessionListFilters,
  ): Promise<CollectionResult<SessionResponse>> {
    const em = this.em.fork()

    const { certificationId, status, page = 1, limit = 25 } = filters
    const effectiveLimit = Math.min(limit, 100)
    const offset = (page - 1) * effectiveLimit

    type SessionRow = {
      id: string
      user_certification_id: string
      kind: string
      status: string
      duration_minutes: number
      content_mix: string
      difficulty: string
      focus_area: SessionFocusArea
      learning_style: string
      last_item_index: number
      started_at: string
      ended_at: string | null
      created_at: string
      updated_at: string
    }

    let whereSql = 'WHERE s.user_id = ?'
    const params: unknown[] = [userId]

    if (certificationId) {
      whereSql += ' AND uc.certification_id = ?'
      params.push(certificationId)
    }
    if (status) {
      whereSql += ' AND s.status = ?'
      params.push(status)
    }

    const rows = await em.getConnection().execute<SessionRow[]>(
      `SELECT s.* FROM study_sessions s
       JOIN user_certifications uc ON uc.id = s.user_certification_id
       ${whereSql}
       ORDER BY s.started_at DESC
       LIMIT ? OFFSET ?`,
      [...params, effectiveLimit, offset],
    )

    const countRows = await em.getConnection().execute<{ count: string }[]>(
      `SELECT COUNT(*) as count FROM study_sessions s
       JOIN user_certifications uc ON uc.id = s.user_certification_id
       ${whereSql}`,
      params,
    )

    const total = Number.parseInt(countRows[0]!.count, 10)

    return {
      items: rows.map((row: SessionRow) => ({
        id: row.id,
        userCertificationId: row.user_certification_id,
        kind: row.kind as SessionResponse['kind'],
        status: row.status as SessionResponse['status'],
        durationMinutes: row.duration_minutes,
        contentMix: row.content_mix,
        difficulty: row.difficulty,
        focusArea: row.focus_area,
        learningStyle: row.learning_style,
        lastItemIndex: row.last_item_index,
        startedAt: new Date(row.started_at).toISOString(),
        endedAt: row.ended_at ? new Date(row.ended_at).toISOString() : null,
      })),
      meta: { total, page, limit: effectiveLimit },
    }
  }

  private async generateItems(
    userId: string,
    sessionId: string,
    plan: ItemPlan[],
    certificationId: string,
    enrollmentId: string,
    difficulty: SessionDifficulty,
    contentMix: SessionContentMix,
  ): Promise<void> {
    const em = this.em.fork()

    for (const itemPlan of plan) {
      if (itemPlan.type === 'reading') {
        const block = await this.composer.compose({
          domain: itemPlan.domain,
          certificationId,
          difficulty,
          preferVideo: contentMix === 'video-based',
        })

        if (block !== null) {
          const item = em.create(SessionItem, {
            session: em.getReference(StudySession, sessionId),
            index: itemPlan.index,
            type: 'reading',
            domain: itemPlan.domain,
            content: block.markdown,
            completed: false,
            sourceChunkIds: block.sourceChunkIds,
            supportingSpans: block.supportingSpans,
          })
          em.persist(item)
        } else {
          const item = em.create(SessionItem, {
            session: em.getReference(StudySession, sessionId),
            index: itemPlan.index,
            type: 'reading',
            domain: itemPlan.domain,
            content: `## ${itemPlan.domain}\n\nContent for this domain is being prepared.`,
            completed: false,
            sourceChunkIds: [],
            supportingSpans: [],
          })
          em.persist(item)
        }
      } else {
        const result =
          itemPlan.anchorChunkId !== undefined
            ? await this.quiz.generateFromChunk(userId, {
                userCertificationId: enrollmentId,
                anchorChunkId: itemPlan.anchorChunkId,
                difficulty,
                format: itemPlan.format,
              })
            : await this.quiz.generate(userId, {
                userCertificationId: enrollmentId,
                domain: itemPlan.domain,
                difficulty,
                format: itemPlan.format,
              })

        const content =
          result.type === 'question'
            ? JSON.stringify({
                questionId: result.data.id,
                question: result.data.question,
                options: result.data.options,
                format: result.data.format,
              })
            : JSON.stringify({ insufficient: true, domain: itemPlan.domain })

        const sourceChunkIds =
          result.type === 'question' ? result.data.provenance.sourceChunkIds : []
        const supportingSpans =
          result.type === 'question' ? result.data.provenance.supportingSpans : []

        const item = em.create(SessionItem, {
          session: em.getReference(StudySession, sessionId),
          index: itemPlan.index,
          type: 'quiz',
          domain: itemPlan.domain,
          content,
          completed: false,
          sourceChunkIds,
          supportingSpans,
        })
        em.persist(item)
      }
    }

    await em.flush()
  }

  private async findNextIncompleteIndex(
    em: EntityManager,
    sessionId: string,
    completedIndex: number,
  ): Promise<number> {
    const nextItem = await em.findOne(
      SessionItem,
      { session: sessionId, completed: false, index: { $gt: completedIndex } },
      { orderBy: { index: 'ASC' } },
    )
    if (nextItem !== null) return nextItem.index

    const lastItem = await em.findOne(
      SessionItem,
      { session: sessionId },
      { orderBy: { index: 'DESC' } },
    )
    return lastItem !== null ? lastItem.index + 1 : completedIndex + 1
  }
}

function mapSessionToDto(session: StudySession): SessionResponse {
  return {
    id: session.id,
    userCertificationId:
      typeof session.userCertification === 'string'
        ? session.userCertification
        : session.userCertification.id,
    kind: session.kind,
    status: session.status,
    durationMinutes: session.durationMinutes,
    contentMix: session.contentMix,
    difficulty: session.difficulty,
    focusArea: session.focusArea,
    learningStyle: session.learningStyle,
    lastItemIndex: session.lastItemIndex,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt ? session.endedAt.toISOString() : null,
  }
}

function mapItemToDto(item: SessionItem): SessionItemResponse {
  return {
    index: item.index,
    type: item.type,
    domain: item.domain,
    content: item.content,
    completed: item.completed,
    sourceChunkIds: item.sourceChunkIds,
    supportingSpans: item.supportingSpans,
  }
}

function resolveSavedConfig(enrollment: UserCertification): SavedSessionConfig {
  const overrides: NonNullable<SavedSessionConfig> = {}

  if (enrollment.sessionOverrideDuration !== null)
    overrides.durationMinutes = enrollment.sessionOverrideDuration

  if (enrollment.sessionOverrideContentMix !== null)
    overrides.contentMix = enrollment.sessionOverrideContentMix

  if (enrollment.sessionOverrideDifficulty !== null) {
    const d = enrollment.sessionOverrideDifficulty
    const sessionDiffs: SessionDifficulty[] = ['beginner', 'intermediate', 'exam-ready']
    if (sessionDiffs.includes(d as SessionDifficulty)) overrides.difficulty = d as SessionDifficulty
  }

  if (enrollment.sessionOverrideLearningStyle !== null) {
    const l = enrollment.sessionOverrideLearningStyle
    const sessionStyles: SessionLearningStyle[] = ['weak-area-focus', 'spaced-repetition', 'cram']
    if (sessionStyles.includes(l as SessionLearningStyle))
      overrides.learningStyle = l as SessionLearningStyle
  }

  return Object.keys(overrides).length > 0 ? overrides : null
}
