import { Global, Module } from '@nestjs/common'
import { DUE_ITEMS_PROVIDER } from '../sessions/due-items.port'
import { SessionsModule } from '../sessions/sessions.module'
import { EnrollmentReviewController, ReviewItemsController } from './review.controller'
import { ReviewService } from './review.service'
import { ReviewAccrualService } from './review-accrual.service'
import { ReviewQueueService } from './review-queue.service'

@Global()
@Module({
  imports: [SessionsModule],
  controllers: [EnrollmentReviewController, ReviewItemsController],
  providers: [
    ReviewQueueService,
    ReviewAccrualService,
    ReviewService,
    { provide: DUE_ITEMS_PROVIDER, useExisting: ReviewQueueService },
  ],
  exports: [DUE_ITEMS_PROVIDER],
})
export class ReviewModule {}
