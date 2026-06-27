import { Module } from '@nestjs/common'
import { AdminModule } from '../admin/admin.module'
import { CertificationsModule } from '../certifications/certifications.module'
import { ContentController } from './content.controller'
import { ContentIngestionQueueModule } from './content-ingestion-queue.module'
import { ContentSourceRepository } from './content-source.repository'
import { ContentSourceService } from './content-source.service'

@Module({
  imports: [AdminModule, CertificationsModule, ContentIngestionQueueModule],
  controllers: [ContentController],
  providers: [ContentSourceService, ContentSourceRepository],
})
export class ContentModule {}
