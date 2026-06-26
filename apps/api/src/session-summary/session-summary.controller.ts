import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common'
import { ApiParam, ApiProperty, ApiPropertyOptional, ApiResponse } from '@nestjs/swagger'
import type { DrillResultResponse, SessionResponse, SessionSummaryResponse } from '@readion/shared'
import { CurrentUser, type CurrentUserPrincipal } from '../auth/auth.guards'
import { SessionSummaryService } from './session-summary.service'

class SessionSummaryDomainStatDto {
  @ApiProperty()
  domain!: string

  @ApiProperty()
  accuracy!: number
}

class WeakAreaDeltaDto {
  @ApiProperty()
  domain!: string

  @ApiProperty()
  delta!: number
}

class SessionReadinessChangeDto {
  @ApiPropertyOptional({ nullable: true })
  before!: number | null

  @ApiPropertyOptional({ nullable: true })
  after!: number | null

  @ApiPropertyOptional({ nullable: true })
  delta!: number | null
}

class SessionQuestionRefDto {
  @ApiProperty()
  responseId!: string

  @ApiProperty()
  question!: string
}

class SessionSummaryResponseDto {
  @ApiProperty()
  questionsAnswered!: number

  @ApiProperty()
  accuracy!: number

  @ApiProperty({ type: [SessionSummaryDomainStatDto] })
  domains!: SessionSummaryDomainStatDto[]

  @ApiProperty({ type: [WeakAreaDeltaDto] })
  weakAreaDeltas!: WeakAreaDeltaDto[]

  @ApiProperty({ type: SessionReadinessChangeDto })
  readiness!: SessionReadinessChangeDto

  @ApiPropertyOptional({ type: SessionQuestionRefDto, nullable: true })
  strongestQuestion!: SessionQuestionRefDto | null

  @ApiPropertyOptional({ type: SessionQuestionRefDto, nullable: true })
  weakestQuestion!: SessionQuestionRefDto | null

  @ApiPropertyOptional({ nullable: true })
  nextFocus!: { domain: string } | null
}

class SessionSummaryEnvelopeDto {
  @ApiProperty({ type: SessionSummaryResponseDto })
  data!: SessionSummaryResponseDto
}

class DrillResultResponseDto {
  @ApiProperty({ enum: ['started', 'no_misses'] })
  status!: 'started' | 'no_misses'

  @ApiPropertyOptional({ description: 'Present when status is "started"' })
  session?: SessionResponse
}

class DrillResultEnvelopeDto {
  @ApiProperty({ type: DrillResultResponseDto })
  data!: DrillResultResponseDto
}

@Controller('sessions')
export class SessionSummaryController {
  constructor(private readonly service: SessionSummaryService) {}

  @Get(':id/summary')
  @ApiParam({ name: 'id', description: 'StudySession id' })
  @ApiResponse({ status: 200, type: SessionSummaryEnvelopeDto })
  @ApiResponse({ status: 404, description: 'Session not found or not owned by user' })
  @ApiResponse({ status: 409, description: 'Session is still active' })
  async summary(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') id: string,
  ): Promise<{ data: SessionSummaryResponse }> {
    const data = await this.service.getSessionSummary(user.id, id)
    return { data }
  }

  @Post(':id/drill')
  @HttpCode(200)
  @ApiParam({ name: 'id', description: 'StudySession id' })
  @ApiResponse({ status: 200, type: DrillResultEnvelopeDto })
  @ApiResponse({ status: 404, description: 'Session not found or not owned by user' })
  async drill(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') id: string,
  ): Promise<{ data: DrillResultResponse }> {
    const data = await this.service.drillSession(user.id, id)
    return { data }
  }
}

@Controller('mock-exams')
export class MockExamSummaryController {
  constructor(private readonly service: SessionSummaryService) {}

  @Get(':id/summary')
  @ApiParam({ name: 'id', description: 'MockExam id' })
  @ApiResponse({ status: 200, type: SessionSummaryEnvelopeDto })
  @ApiResponse({ status: 404, description: 'Mock exam not found or not owned by user' })
  @ApiResponse({ status: 409, description: 'Mock exam is still in progress' })
  async summary(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') id: string,
  ): Promise<{ data: SessionSummaryResponse }> {
    const data = await this.service.getMockSummary(user.id, id)
    return { data }
  }

  @Post(':id/drill')
  @HttpCode(200)
  @ApiParam({ name: 'id', description: 'MockExam id' })
  @ApiResponse({ status: 200, type: DrillResultEnvelopeDto })
  @ApiResponse({ status: 404, description: 'Mock exam not found or not owned by user' })
  async drill(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') id: string,
  ): Promise<{ data: DrillResultResponse }> {
    const data = await this.service.drillMock(user.id, id)
    return { data }
  }
}
