import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import type { ContentSourceType } from '@readion/shared'
import { contentSourceTypes } from '@readion/shared'
import type { Queue } from 'bullmq'
import type { IngestionJobData } from '../processor/ingestion.processor'
import { ingestionQueueName } from './content-queues.module'

@Injectable()
export class ContentQueuesService {
  private readonly queues = new Map<ContentSourceType, Queue>()

  constructor(
    @InjectQueue(ingestionQueueName('web')) webQueue: Queue,
    @InjectQueue(ingestionQueueName('pdf')) pdfQueue: Queue,
    @InjectQueue(ingestionQueueName('youtube')) youtubeQueue: Queue,
    @InjectQueue(ingestionQueueName('reddit')) redditQueue: Queue,
    @InjectQueue(ingestionQueueName('github')) githubQueue: Queue,
    @InjectQueue(ingestionQueueName('podcast')) podcastQueue: Queue,
    @InjectQueue(ingestionQueueName('anki')) ankiQueue: Queue,
    @InjectQueue(ingestionQueueName('quizlet')) quizletQueue: Queue,
  ) {
    const queueList: Queue[] = [
      webQueue,
      pdfQueue,
      youtubeQueue,
      redditQueue,
      githubQueue,
      podcastQueue,
      ankiQueue,
      quizletQueue,
    ]
    contentSourceTypes.forEach((type, i) => {
      this.queues.set(type, queueList[i]!)
    })
  }

  async enqueue(
    sourceId: string,
    sourceType: ContentSourceType,
    domains: string[],
    priority?: number,
  ): Promise<void> {
    const queue = this.queues.get(sourceType)
    if (!queue) throw new Error(`No queue registered for source type: ${sourceType}`)

    const data: IngestionJobData = { contentSourceId: sourceId, domains }
    await queue.add('ingest', data, { priority })
  }

  getQueue(type: ContentSourceType): Queue | undefined {
    return this.queues.get(type)
  }
}
