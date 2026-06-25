import { Module } from '@nestjs/common'
import { WeakAreasService } from './weak-areas.service'

@Module({
  providers: [WeakAreasService],
  exports: [WeakAreasService],
})
export class WeakAreasModule {}
