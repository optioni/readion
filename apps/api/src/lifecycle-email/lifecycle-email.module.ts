import { Module } from '@nestjs/common'
import { MailModule } from '../mail/mail.module'
import { ReadinessModule } from '../readiness/readiness.module'
import { ReviewModule } from '../review/review.module'
import { WeakAreasModule } from '../weak-areas/weak-areas.module'
import { EmailController } from './email.controller'
import { InternalLifecycleController } from './internal-lifecycle.controller'
import { InternalSecretGuard } from './internal-secret.guard'
import { LifecycleEmailService } from './lifecycle-email.service'

@Module({
  imports: [MailModule, ReadinessModule, WeakAreasModule, ReviewModule],
  controllers: [EmailController, InternalLifecycleController],
  providers: [LifecycleEmailService, InternalSecretGuard],
  exports: [LifecycleEmailService],
})
export class LifecycleEmailModule {}
