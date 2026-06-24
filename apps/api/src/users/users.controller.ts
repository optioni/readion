import { Body, Controller, Delete, Get, HttpCode, Patch } from '@nestjs/common'
import { CurrentUser, type CurrentUserPrincipal } from '../auth/auth.guards'
import { UsersService } from './users.service'

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: CurrentUserPrincipal) {
    return this.users.getProfile(user.id)
  }

  @Patch('me')
  updateMe(@CurrentUser() user: CurrentUserPrincipal, @Body() body: unknown) {
    return this.users.updateProfile(user.id, body)
  }

  @Delete('me')
  @HttpCode(204)
  deleteMe(@CurrentUser() user: CurrentUserPrincipal, @Body() body: unknown) {
    return this.users.deleteOwnAccount(user.id, body)
  }
}
