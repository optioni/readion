import { Module } from '@nestjs/common'
import { UsersModule } from '../users/users.module'
import { AdminController } from './admin.controller'
import { AdminService } from './admin.service'
import { AuditLogService } from './audit-log.service'
import { QuarantineAdminController } from './quarantine-admin.controller'
import { QuarantineAdminService } from './quarantine-admin.service'

@Module({
  imports: [UsersModule],
  controllers: [AdminController, QuarantineAdminController],
  providers: [AdminService, AuditLogService, QuarantineAdminService],
  exports: [AuditLogService],
})
export class AdminModule {}
