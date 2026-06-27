import { Module } from '@nestjs/common'
import { AdminModule } from '../admin/admin.module'
import { CertificationsModule } from '../certifications/certifications.module'
import { CertDiscoveryService } from './cert-discovery.service'
import { CERT_SEARCH_PORT } from './cert-discovery.types'
import { CertExtractionQueueModule } from './cert-extraction-queue.module'
import { CertSetupController } from './cert-setup.controller'
import { CertSetupService } from './cert-setup.service'
import { CertWebSearchAdapter } from './cert-web-search.adapter'

@Module({
  imports: [AdminModule, CertificationsModule, CertExtractionQueueModule],
  controllers: [CertSetupController],
  providers: [
    CertSetupService,
    CertDiscoveryService,
    { provide: CERT_SEARCH_PORT, useClass: CertWebSearchAdapter },
  ],
})
export class CertSetupModule {}
