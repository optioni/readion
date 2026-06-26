import { Module } from '@nestjs/common'
import { WeakAreasModule } from '../weak-areas/weak-areas.module'
import { ReadinessController } from './readiness.controller'
import { ReadinessService } from './readiness.service'

@Module({
  imports: [WeakAreasModule],
  controllers: [ReadinessController],
  providers: [ReadinessService],
  exports: [ReadinessService],
})
export class ReadinessModule {}
