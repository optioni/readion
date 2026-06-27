import { Controller, Get, Query } from '@nestjs/common'
import { Public } from '../auth/auth.guards'
import { LifecycleEmailService } from './lifecycle-email.service'

const GENERIC_CONFIRMATION = { unsubscribed: true } as const

@Controller('email')
export class EmailController {
  constructor(private readonly lifecycleEmail: LifecycleEmailService) {}

  @Public()
  @Get('unsubscribe')
  async unsubscribe(@Query('token') token?: string) {
    await this.lifecycleEmail.unsubscribe(token ?? '')
    return GENERIC_CONFIRMATION
  }
}
