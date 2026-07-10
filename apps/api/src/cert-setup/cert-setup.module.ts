import { Module } from '@nestjs/common'
import { AdminModule } from '../admin/admin.module'
import { CertificationsModule } from '../certifications/certifications.module'
import { CertDiscoveryService } from './cert-discovery.service'
import { CERT_SEARCH_PORT } from './cert-discovery.types'
import { CertExtractionQueueModule } from './cert-extraction-queue.module'
import { certSearchMetricProviders } from './cert-search.metrics'
import { CertSetupController } from './cert-setup.controller'
import { CertSetupService } from './cert-setup.service'
import { CertWebSearchAdapter } from './cert-web-search.adapter'
import { JobEventsService } from './job-events.service'
import { CERT_SEARCH_HTTP_CLIENT, TavilySearchClient } from './tavily-search.client'

@Module({
  imports: [AdminModule, CertificationsModule, CertExtractionQueueModule],
  controllers: [CertSetupController],
  providers: [
    CertSetupService,
    JobEventsService,
    CertDiscoveryService,
    { provide: CERT_SEARCH_PORT, useClass: CertWebSearchAdapter },
    { provide: CERT_SEARCH_HTTP_CLIENT, useClass: TavilySearchClient },
    ...certSearchMetricProviders(),
  ],
})
export class CertSetupModule {}
