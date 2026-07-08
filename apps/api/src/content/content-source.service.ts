import { EntityManager } from '@mikro-orm/core'
import { InjectQueue } from '@nestjs/bullmq'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Certification } from '@readion/db'
import {
  AuditAction,
  type ContentSourceResponse,
  type ContentSourceType,
  type EnqueuedJobResponse,
  type IngestionJobStatus,
  ingestionQueueName,
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
  type RegisterSourceRequest,
} from '@readion/shared'
import type { Job, JobType, Queue } from 'bullmq'
import { AuditLogService } from '../admin/audit-log.service'
import type { CollectionResult } from '../common/interceptors/response.interceptor'
import { mapJobToStatus, mapSourceToDto } from './content.mapper'
import {
  enabledChangeSnapshot,
  reingestSnapshot,
  sourceAddedSnapshot,
} from './content-audit.snapshots'
import { ContentSourceRepository } from './content-source.repository'

export interface ListContentSourcesQuery {
  certificationId?: string
  page?: number
  limit?: number
}

interface IngestionJobData {
  contentSourceId: string
  domains: string[]
}

interface ResolvedPagination {
  page: number
  limit: number
}

const JOB_SCAN_STATES: JobType[] = ['waiting', 'active', 'completed', 'failed', 'delayed', 'paused']
const JOB_SCAN_WINDOW = 50

@Injectable()
export class ContentSourceService {
  private readonly queues = new Map<ContentSourceType, Queue>()

  constructor(
    private readonly repo: ContentSourceRepository,
    private readonly em: EntityManager,
    private readonly auditLog: AuditLogService,
    @InjectQueue(ingestionQueueName('web')) webQueue: Queue,
    @InjectQueue(ingestionQueueName('pdf')) pdfQueue: Queue,
    @InjectQueue(ingestionQueueName('youtube')) youtubeQueue: Queue,
    @InjectQueue(ingestionQueueName('reddit')) redditQueue: Queue,
    @InjectQueue(ingestionQueueName('github')) githubQueue: Queue,
    @InjectQueue(ingestionQueueName('podcast')) podcastQueue: Queue,
    @InjectQueue(ingestionQueueName('anki')) ankiQueue: Queue,
  ) {
    this.queues.set('web', webQueue)
    this.queues.set('pdf', pdfQueue)
    this.queues.set('youtube', youtubeQueue)
    this.queues.set('reddit', redditQueue)
    this.queues.set('github', githubQueue)
    this.queues.set('podcast', podcastQueue)
    this.queues.set('anki', ankiQueue)
  }

  async register(
    actorUserId: string,
    input: RegisterSourceRequest,
  ): Promise<ContentSourceResponse> {
    const cert = await this.em.fork().findOne(Certification, { id: input.certificationId })
    if (cert === null) {
      throw new NotFoundException('Certification not found')
    }

    const source = await this.repo.create({
      certificationId: input.certificationId,
      type: input.type,
      url: input.url,
      recheckIntervalMinutes: input.recheckIntervalMinutes,
    })

    await this.auditLog.record({
      actorUserId,
      action: AuditAction.SourceAdded,
      targetType: 'ContentSource',
      targetId: source.id,
      after: sourceAddedSnapshot(source),
    })

    return mapSourceToDto(source, 0)
  }

  async list(query: ListContentSourcesQuery): Promise<CollectionResult<ContentSourceResponse>> {
    const { page, limit } = resolvePagination(query.page, query.limit)
    const { items, total } = await this.repo.list({
      certificationId: query.certificationId,
      page,
      limit,
    })

    const counts = await this.countChunksBySource(items.map((item) => item.id))

    return {
      items: items.map((item) => mapSourceToDto(item, counts.get(item.id) ?? 0)),
      meta: { total, page, limit },
    }
  }

  async findOne(id: string): Promise<ContentSourceResponse> {
    const source = await this.repo.findById(id)
    if (source === null) {
      throw new NotFoundException('Content source not found')
    }
    const counts = await this.countChunksBySource([source.id])
    return mapSourceToDto(source, counts.get(source.id) ?? 0)
  }

  async setEnabled(
    actorUserId: string,
    id: string,
    enabled: boolean,
  ): Promise<ContentSourceResponse> {
    const source = await this.repo.findById(id)
    if (source === null) {
      throw new NotFoundException('Content source not found')
    }

    if (source.enabled === enabled) {
      const counts = await this.countChunksBySource([source.id])
      return mapSourceToDto(source, counts.get(source.id) ?? 0)
    }

    const updated = await this.repo.setEnabled(id, enabled)
    if (updated === null) {
      throw new NotFoundException('Content source not found')
    }

    const { before, after } = enabledChangeSnapshot(!enabled, enabled)
    await this.auditLog.record({
      actorUserId,
      action: enabled ? AuditAction.SourceEnabled : AuditAction.SourceDisabled,
      targetType: 'ContentSource',
      targetId: id,
      before,
      after,
    })

    const counts = await this.countChunksBySource([updated.id])
    return mapSourceToDto(updated, counts.get(updated.id) ?? 0)
  }

  async reingest(actorUserId: string, id: string): Promise<EnqueuedJobResponse> {
    const source = await this.repo.findById(id)
    if (source === null) {
      throw new NotFoundException('Content source not found')
    }
    if (!source.enabled) {
      throw new ConflictException('Cannot re-ingest a disabled source')
    }

    const cert = await this.em.fork().findOne(Certification, { id: source.certificationId })
    const domains = cert?.domains.map((domain) => domain.name) ?? []

    const queue = this.resolveQueue(source.type)
    const data: IngestionJobData = { contentSourceId: source.id, domains }
    const job = await queue.add('ingest', data)
    const jobId = String(job.id)
    const state = await job.getState()

    await this.auditLog.record({
      actorUserId,
      action: AuditAction.SourceReingested,
      targetType: 'ContentSource',
      targetId: source.id,
      after: reingestSnapshot(jobId),
    })

    return { jobId, contentSourceId: source.id, state }
  }

  async getJobStatus(id: string, jobId: string): Promise<IngestionJobStatus> {
    const source = await this.repo.findById(id)
    if (source === null) {
      throw new NotFoundException('Content source not found')
    }

    const queue = this.resolveQueue(source.type)
    const job = await queue.getJob(jobId)
    if (job === undefined || job.data?.contentSourceId !== id) {
      throw new NotFoundException('Ingestion job not found')
    }

    const state = await job.getState()
    return mapJobToStatus(job, state)
  }

  async listJobs(id: string): Promise<CollectionResult<IngestionJobStatus>> {
    const source = await this.repo.findById(id)
    if (source === null) {
      throw new NotFoundException('Content source not found')
    }

    const queue = this.resolveQueue(source.type)
    const jobs = await queue.getJobs(JOB_SCAN_STATES, 0, JOB_SCAN_WINDOW)
    const owned = jobs
      .filter((job): job is Job<IngestionJobData> => job.data?.contentSourceId === id)
      .sort(byMostRecent)

    const items = await Promise.all(
      owned.map(async (job) => mapJobToStatus(job, await job.getState())),
    )

    return { items, meta: { total: items.length, page: 1, limit: JOB_SCAN_WINDOW } }
  }

  private resolveQueue(type: ContentSourceType): Queue {
    const queue = this.queues.get(type)
    if (queue === undefined) {
      throw new NotFoundException(`No ingestion queue registered for source type: ${type}`)
    }
    return queue
  }

  private async countChunksBySource(sourceIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>()

    if (sourceIds.length === 0) {
      return counts
    }

    const placeholders = sourceIds.map(() => '?').join(', ')
    const rows = await this.em.getConnection().execute<{ content_source_id: string; count: number }[]>(
      `SELECT content_source_id, count(*)::int AS count
         FROM content_chunks
         WHERE content_source_id IN (${placeholders})
         GROUP BY content_source_id`,
      sourceIds,
    )

    for (const row of rows) {
      counts.set(row.content_source_id, row.count)
    }

    return counts
  }
}

function resolvePagination(page?: number, limit?: number): ResolvedPagination {
  const resolvedPage = page !== undefined && page > 0 ? Math.floor(page) : 1
  const requestedLimit = limit !== undefined && limit > 0 ? Math.floor(limit) : PAGE_SIZE_DEFAULT
  return { page: resolvedPage, limit: Math.min(requestedLimit, PAGE_SIZE_MAX) }
}

function byMostRecent(a: Job, b: Job): number {
  const byTimestamp = (b.timestamp ?? 0) - (a.timestamp ?? 0)
  if (byTimestamp !== 0) {
    return byTimestamp
  }
  return Number(b.id ?? 0) - Number(a.id ?? 0)
}
