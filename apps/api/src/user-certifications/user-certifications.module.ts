import { Module } from '@nestjs/common'
import { UserCertificationsController } from './user-certifications.controller'
import { UserCertificationsService } from './user-certifications.service'

@Module({
  controllers: [UserCertificationsController],
  providers: [UserCertificationsService],
  exports: [UserCertificationsService],
})
export class UserCertificationsModule {}
