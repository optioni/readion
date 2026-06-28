import { Controller, Get } from '@nestjs/common'
import { ApiProperty, ApiPropertyOptional, ApiResponse } from '@nestjs/swagger'
import type { AnalyticsOverview, ExamOutcomeResponse, RetentionCohort } from '@readion/shared'
import { Roles } from '../auth/auth.guards'
import { AnalyticsService } from './analytics.service'

class AnalyticsMetricDto {
  @ApiProperty()
  value!: number
  @ApiPropertyOptional({ type: Number })
  population?: number
}

class AnalyticsTargetedMetricDto extends AnalyticsMetricDto {
  @ApiProperty()
  target!: number
}

class RetentionCohortDto {
  @ApiProperty()
  cohortWeek!: string
  @ApiProperty()
  size!: number
  @ApiProperty()
  retained!: number
  @ApiProperty()
  fraction!: number
}

class RetentionMetricDto extends AnalyticsTargetedMetricDto {
  @ApiProperty({ type: [RetentionCohortDto], required: false })
  cohorts?: RetentionCohort[]
}

class PassRateBreakdownDto {
  @ApiProperty()
  passed!: number
  @ApiProperty()
  did_not_pass!: number
  @ApiProperty()
  not_yet!: number
  @ApiProperty()
  dismissed!: number
}

class PassRateMetricDto {
  @ApiProperty({ type: PassRateBreakdownDto })
  value!: Record<ExamOutcomeResponse, number>
  @ApiPropertyOptional({ type: Number })
  population?: number
}

class AnalyticsOverviewDto {
  @ApiProperty({ type: AnalyticsMetricDto })
  activeUsers!: AnalyticsMetricDto
  @ApiProperty({ type: AnalyticsTargetedMetricDto })
  readinessGain!: AnalyticsTargetedMetricDto
  @ApiProperty({ type: AnalyticsTargetedMetricDto })
  sessionsPerWeek!: AnalyticsTargetedMetricDto
  @ApiProperty({ type: RetentionMetricDto })
  retentionW2!: RetentionMetricDto
  @ApiProperty({ type: RetentionMetricDto })
  retentionW4!: RetentionMetricDto
  @ApiProperty({ type: AnalyticsTargetedMetricDto })
  completionRate!: AnalyticsTargetedMetricDto
  @ApiProperty({ type: AnalyticsTargetedMetricDto })
  agentEngagement!: AnalyticsTargetedMetricDto
  @ApiProperty({ type: AnalyticsTargetedMetricDto })
  llmCostPerActiveUser!: AnalyticsTargetedMetricDto
  @ApiProperty({ type: PassRateMetricDto })
  passRateBreakdown!: PassRateMetricDto
}

class AnalyticsOverviewResponseDto {
  @ApiProperty({ type: AnalyticsOverviewDto })
  data!: AnalyticsOverviewDto
}

@Controller('admin/analytics')
@Roles('admin')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('overview')
  @ApiResponse({ status: 200, type: AnalyticsOverviewResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  getOverview(): Promise<AnalyticsOverview> {
    return this.service.getOverview()
  }
}
