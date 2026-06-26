import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common'
import type { DrillResultResponse, SessionSummaryResponse } from '@readion/shared'
import { CurrentUser, type CurrentUserPrincipal } from '../auth/auth.guards'
import { SessionSummaryService } from './session-summary.service'

@Controller('sessions')
export class SessionSummaryController {
  constructor(private readonly service: SessionSummaryService) {}

  @Get(':id/summary')
  async summary(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') id: string,
  ): Promise<{ data: SessionSummaryResponse }> {
    const data = await this.service.getSessionSummary(user.id, id)
    return { data }
  }

  @Post(':id/drill')
  @HttpCode(200)
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
  async summary(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') id: string,
  ): Promise<{ data: SessionSummaryResponse }> {
    const data = await this.service.getMockSummary(user.id, id)
    return { data }
  }

  @Post(':id/drill')
  @HttpCode(200)
  async drill(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') id: string,
  ): Promise<{ data: DrillResultResponse }> {
    const data = await this.service.drillMock(user.id, id)
    return { data }
  }
}
