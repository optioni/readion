import { Controller, Get, Param } from '@nestjs/common'
import { ApiProperty, ApiResponse } from '@nestjs/swagger'
import type { CertificationState, DomainCoverage } from '@readion/shared'
import { Roles } from '../auth/auth.guards'
import type { CoverageReport } from './cert-coverage.service'
import { CertificationCoverageService } from './cert-coverage.service'

class DomainCoverageDto {
  @ApiProperty()
  name!: string
  @ApiProperty()
  chunkCount!: number
  @ApiProperty()
  chunkThreshold!: number
  @ApiProperty()
  enabledSourceCount!: number
  @ApiProperty()
  met!: boolean
}

class CoverageReportDto {
  @ApiProperty({ type: [DomainCoverageDto] })
  domains!: DomainCoverage[]
  @ApiProperty()
  totalChunks!: number
  @ApiProperty()
  totalThreshold!: number
  @ApiProperty({ enum: ['draft', 'live'] })
  state!: CertificationState
  @ApiProperty()
  met!: boolean
}

class CoverageReportResponseDto {
  @ApiProperty({ type: CoverageReportDto })
  data!: CoverageReport
}

@Controller('certifications')
export class CertificationCoverageController {
  constructor(private readonly service: CertificationCoverageService) {}

  @Get(':id/coverage')
  @Roles('admin')
  @ApiResponse({ status: 200, type: CoverageReportResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  @ApiResponse({ status: 404, description: 'Certification not found' })
  async coverage(@Param('id') id: string): Promise<{ data: CoverageReport }> {
    const data = await this.service.getCoverageReport(id)
    return { data }
  }
}
