import { Module } from '@nestjs/common'
import { MailModule } from '../mail/mail.module'
import { ReadinessModule } from '../readiness/readiness.module'
import { ReviewModule } from '../review/review.module'
import { WeakAreasModule } from '../weak-areas/weak-areas.module'
import { LifecycleEmailService } from './lifecycle-email.service'

@Module({
  imports: [MailModule, ReadinessModule, WeakAreasModule, ReviewModule],
  providers: [LifecycleEmailService],
  exports: [LifecycleEmailService],
})
export class LifecycleEmailModule {}
