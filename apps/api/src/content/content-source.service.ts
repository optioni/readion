import { EntityManager } from '@mikro-orm/core'
import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import type {
  ContentSourceResponse,
  EnqueuedJobResponse,
  IngestionJobStatus,
  RegisterSourceRequest,
} from '@readion/shared'
import { ingestionQueueName } from '@readion/shared'
import type { Queue } from 'bullmq'
import { AuditLogService } from '../admin/audit-log.service'
import type { CollectionResult } from '../common/interceptors/response.interceptor'
import { ContentSourceRepository } from './content-source.repository'

export interface ListContentSourcesQuery {
  certificationId?: string
  page?: number
  limit?: number
}

@Injectable()
export class ContentSourceService {
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
    @InjectQueue(ingestionQueueName('quizlet')) quizletQueue: Queue,
  ) {
    void [
      this.repo,
      this.em,
      this.auditLog,
      webQueue,
      pdfQueue,
      youtubeQueue,
      redditQueue,
      githubQueue,
      podcastQueue,
      ankiQueue,
      quizletQueue,
    ]
  }

  register(_actorUserId: string, _input: RegisterSourceRequest): Promise<ContentSourceResponse> {
    throw new Error('not implemented')
  }

  list(_query: ListContentSourcesQuery): Promise<CollectionResult<ContentSourceResponse>> {
    throw new Error('not implemented')
  }

  findOne(_id: string): Promise<ContentSourceResponse> {
    throw new Error('not implemented')
  }

  setEnabled(
    _actorUserId: string,
    _id: string,
    _enabled: boolean,
  ): Promise<ContentSourceResponse> {
    throw new Error('not implemented')
  }

  reingest(_actorUserId: string, _id: string): Promise<EnqueuedJobResponse> {
    throw new Error('not implemented')
  }

  getJobStatus(_id: string, _jobId: string): Promise<IngestionJobStatus> {
    throw new Error('not implemented')
  }

  listJobs(_id: string): Promise<CollectionResult<IngestionJobStatus>> {
    throw new Error('not implemented')
  }
}
