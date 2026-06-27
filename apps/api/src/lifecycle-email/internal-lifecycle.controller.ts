import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'
import type { ValidationErrorItem } from '@readion/shared'
import { lifecycleEnrollmentIdsRequestSchema, lifecycleUserIdsRequestSchema } from '@readion/shared'
import type { z } from 'zod'
import { Public } from '../auth/auth.guards'
import { InternalSecretGuard } from './internal-secret.guard'
import { LifecycleEmailService } from './lifecycle-email.service'

@Public()
@ApiExcludeController()
@UseGuards(InternalSecretGuard)
@Controller('internal/lifecycle')
export class InternalLifecycleController {
  constructor(private readonly lifecycleEmail: LifecycleEmailService) {}

  @HttpCode(HttpStatus.OK)
  @Post('digest')
  async digest(@Body() body: unknown): Promise<void> {
    const { userIds } = parseBody(lifecycleUserIdsRequestSchema, body)
    for (const userId of userIds) {
      await this.lifecycleEmail.sendDigest(userId)
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('nudge')
  async nudge(@Body() body: unknown): Promise<void> {
    const { userCertificationIds } = parseBody(lifecycleEnrollmentIdsRequestSchema, body)
    for (const userCertificationId of userCertificationIds) {
      await this.lifecycleEmail.maybeSendNudge(userCertificationId)
    }
  }
}

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body)
  if (!result.success) {
    throw new UnprocessableEntityException({
      errors: result.error.issues.map(
        (issue): ValidationErrorItem => ({
          field: issue.path.map(String).join('.') || 'body',
          message: issue.message,
        }),
      ),
    })
  }
  return result.data
}
