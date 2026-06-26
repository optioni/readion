import { Controller, Get, Param } from '@nestjs/common'
import { ApiProperty, ApiResponse } from '@nestjs/swagger'
import type { ReadinessResponse } from '@readion/shared'
import { CurrentUser, type CurrentUserPrincipal } from '../auth/auth.guards'
import { ReadinessService } from './readiness.service'

class ReadinessTrajectoryDto {
  @ApiProperty()
  weeksToReady!: number
}

class ReadinessResponseDto {
  @ApiProperty()
  calibrated!: boolean
  @ApiProperty({ nullable: true, type: Number })
  score!: number | null
  @ApiProperty({ nullable: true, type: ReadinessTrajectoryDto })
  trajectory!: ReadinessTrajectoryDto | null
}

class ReadinessDetailResponseDto {
  @ApiProperty({ type: ReadinessResponseDto })
  data!: ReadinessResponse
}

@Controller('user-certifications')
export class ReadinessController {
  constructor(private readonly readiness: ReadinessService) {}

  @Get(':id/readiness')
  @ApiResponse({ status: 200, type: ReadinessDetailResponseDto })
  async read(
    @CurrentUser() user: CurrentUserPrincipal,
    @Param('id') id: string,
  ): Promise<{ data: ReadinessResponse }> {
    const result = await this.readiness.readForOwner(user.id, id)
    return { data: result }
  }
}
