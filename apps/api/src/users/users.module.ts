import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { LastActiveAdminGuard } from './last-active-admin.guard'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'

@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [LastActiveAdminGuard, UsersService],
  exports: [LastActiveAdminGuard, UsersService],
})
export class UsersModule {}
