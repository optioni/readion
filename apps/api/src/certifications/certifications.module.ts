import { Module } from '@nestjs/common'
import { queryCoverageStats } from '@readion/db'
import { CertificationCoverageController } from './cert-coverage.controller'
import { CertificationCoverageService, COVERAGE_STATS_QUERY } from './cert-coverage.service'
import { CertificationsController } from './certifications.controller'
import { CertificationsService } from './certifications.service'

@Module({
  controllers: [CertificationsController, CertificationCoverageController],
  providers: [
    CertificationsService,
    CertificationCoverageService,
    {
      provide: COVERAGE_STATS_QUERY,
      useValue: queryCoverageStats,
    },
  ],
  exports: [CertificationsService],
})
export class CertificationsModule {}
