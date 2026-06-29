import { Body, Controller, Delete, Get, HttpCode, Patch } from '@nestjs/common'
import { ApiBody, ApiProperty, ApiPropertyOptional, ApiResponse } from '@nestjs/swagger'
import type {
  RoleValue,
  SessionDefaults,
  UpdateUserProfileRequest,
  UserProfileResponse,
} from '@readion/shared'
import {
  roles,
  sessionDefaultContentMixes,
  sessionDefaultDifficulties,
  sessionDefaultDurations,
  sessionDefaultFocusAreas,
  sessionDefaultLearningStyles,
} from '@readion/shared'
import { CurrentUser, type CurrentUserPrincipal } from '../auth/auth.guards'
import { UsersService } from './users.service'

class SessionDefaultsDto {
  @ApiProperty({ enum: sessionDefaultDurations })
  duration!: SessionDefaults['duration']
  @ApiProperty({ enum: sessionDefaultContentMixes })
  contentMix!: SessionDefaults['contentMix']
  @ApiProperty({ enum: sessionDefaultDifficulties })
  difficulty!: SessionDefaults['difficulty']
  @ApiProperty({ enum: sessionDefaultFocusAreas })
  focusArea!: SessionDefaults['focusArea']
  @ApiProperty({ enum: sessionDefaultLearningStyles })
  learningStyle!: SessionDefaults['learningStyle']
}

class UserProfileDto {
  @ApiProperty()
  id!: string
  @ApiProperty()
  email!: string
  @ApiProperty({ enum: roles })
  role!: RoleValue
  @ApiProperty()
  emailVerified!: boolean
  @ApiProperty()
  displayTimezone!: string
  @ApiProperty()
  digestOptOut!: boolean
  @ApiProperty({ type: SessionDefaultsDto })
  sessionDefaults!: SessionDefaults
}

class UserProfileResponseDto {
  @ApiProperty({ type: UserProfileDto })
  data!: UserProfileResponse
}

class UpdateSessionDefaultsDto {
  @ApiPropertyOptional({ enum: sessionDefaultDurations })
  duration?: SessionDefaults['duration']
  @ApiPropertyOptional({ enum: sessionDefaultContentMixes })
  contentMix?: SessionDefaults['contentMix']
  @ApiPropertyOptional({ enum: sessionDefaultDifficulties })
  difficulty?: SessionDefaults['difficulty']
  @ApiPropertyOptional({ enum: sessionDefaultFocusAreas })
  focusArea?: SessionDefaults['focusArea']
  @ApiPropertyOptional({ enum: sessionDefaultLearningStyles })
  learningStyle?: SessionDefaults['learningStyle']
}

class UpdateUserProfileRequestDto {
  @ApiPropertyOptional()
  displayTimezone?: string
  @ApiPropertyOptional()
  digestOptOut?: boolean
  @ApiPropertyOptional({ type: UpdateSessionDefaultsDto })
  sessionDefaults?: UpdateUserProfileRequest['sessionDefaults']
}

class DeleteAccountRequestDto {
  @ApiProperty()
  password!: string
}

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiResponse({ status: 200, type: UserProfileResponseDto })
  getMe(@CurrentUser() user: CurrentUserPrincipal): Promise<UserProfileResponse> {
    return this.users.getProfile(user.id)
  }

  @Patch('me')
  @ApiBody({ type: UpdateUserProfileRequestDto })
  @ApiResponse({ status: 200, type: UserProfileResponseDto })
  updateMe(
    @CurrentUser() user: CurrentUserPrincipal,
    @Body() body: unknown,
  ): Promise<UserProfileResponse> {
    return this.users.updateProfile(user.id, body)
  }

  @Delete('me')
  @HttpCode(204)
  @ApiBody({ type: DeleteAccountRequestDto })
  @ApiResponse({ status: 204 })
  deleteMe(@CurrentUser() user: CurrentUserPrincipal, @Body() body: unknown): Promise<void> {
    return this.users.deleteOwnAccount(user.id, body)
  }
}
