import { Module } from '@nestjs/common'
import { ReadinessModule } from '../readiness/readiness.module'
import { WeakAreasModule } from '../weak-areas/weak-areas.module'
import { UserCertificationsController } from './user-certifications.controller'
import { UserCertificationsService } from './user-certifications.service'

@Module({
  imports: [WeakAreasModule, ReadinessModule],
  controllers: [UserCertificationsController],
  providers: [UserCertificationsService],
  exports: [UserCertificationsService],
})
export class UserCertificationsModule {}
