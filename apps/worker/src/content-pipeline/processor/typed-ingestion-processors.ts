import { Processor } from '@nestjs/bullmq'
import { ingestionQueueName } from '../queues/content-queues.module'
import { IngestionProcessor } from './ingestion.processor'
import { IngestionService } from './ingestion.service'

@Processor(ingestionQueueName('web'))
export class WebIngestionProcessor extends IngestionProcessor {
  constructor(ingestionService: IngestionService) {
    super('web', ingestionService)
  }
}

@Processor(ingestionQueueName('pdf'))
export class PdfIngestionProcessor extends IngestionProcessor {
  constructor(ingestionService: IngestionService) {
    super('pdf', ingestionService)
  }
}

@Processor(ingestionQueueName('youtube'))
export class YouTubeIngestionProcessor extends IngestionProcessor {
  constructor(ingestionService: IngestionService) {
    super('youtube', ingestionService)
  }
}

@Processor(ingestionQueueName('reddit'))
export class RedditIngestionProcessor extends IngestionProcessor {
  constructor(ingestionService: IngestionService) {
    super('reddit', ingestionService)
  }
}

@Processor(ingestionQueueName('github'))
export class GitHubIngestionProcessor extends IngestionProcessor {
  constructor(ingestionService: IngestionService) {
    super('github', ingestionService)
  }
}

@Processor(ingestionQueueName('podcast'))
export class PodcastIngestionProcessor extends IngestionProcessor {
  constructor(ingestionService: IngestionService) {
    super('podcast', ingestionService)
  }
}

@Processor(ingestionQueueName('anki'))
export class AnkiIngestionProcessor extends IngestionProcessor {
  constructor(ingestionService: IngestionService) {
    super('anki', ingestionService)
  }
}

@Processor(ingestionQueueName('quizlet'))
export class QuizletIngestionProcessor extends IngestionProcessor {
  constructor(ingestionService: IngestionService) {
    super('quizlet', ingestionService)
  }
}

export const INGESTION_PROCESSORS = [
  WebIngestionProcessor,
  PdfIngestionProcessor,
  YouTubeIngestionProcessor,
  RedditIngestionProcessor,
  GitHubIngestionProcessor,
  PodcastIngestionProcessor,
  AnkiIngestionProcessor,
  QuizletIngestionProcessor,
] as const
