import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import type { SessionFillJobPayload, SessionItemPlan } from '@readion/shared'
import { SESSION_FILL_QUEUE } from '@readion/shared'
import type { Queue } from 'bullmq'

@Injectable()
export class SessionFillQueueService {
  constructor(@InjectQueue(SESSION_FILL_QUEUE) private readonly queue: Queue) {}

  async enqueueSessionFill(
    sessionId: string,
    startFromIndex: number,
    remainingItems: SessionItemPlan[],
    certificationId: string,
    enrollmentId: string,
    difficulty: string,
    contentMix: string,
  ): Promise<void> {
    const payload: SessionFillJobPayload = {
      sessionId,
      startFromIndex,
      remainingItems,
      certificationId,
      enrollmentId,
      difficulty,
      contentMix,
    }
    await this.queue.add('fill', payload, {
      priority: 1,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    })
  }
}
