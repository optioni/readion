import { Module } from '@nestjs/common'
import { UserPurgeService } from './user-purge.service'

@Module({
  providers: [UserPurgeService],
  exports: [UserPurgeService],
})
export class UsersModule {}
