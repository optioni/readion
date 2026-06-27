import { Module } from '@nestjs/common'
import { UsersModule } from '../users/users.module'
import { AdminController } from './admin.controller'
import { AdminService } from './admin.service'
import { AuditLogService } from './audit-log.service'

@Module({
  imports: [UsersModule],
  controllers: [AdminController],
  providers: [AdminService, AuditLogService],
  exports: [AuditLogService],
})
export class AdminModule {}
