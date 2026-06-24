import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { RoleValue } from '@readion/shared'
import { AccessTokenService } from './access-token.service'

const IS_PUBLIC_KEY = 'auth:is-public'
const ROLES_KEY = 'auth:roles'

export type CurrentUserPrincipal = {
  id: string
  role: RoleValue
}

type AuthenticatedRequest = {
  headers?: Record<string, string | undefined>
  user?: CurrentUserPrincipal
}

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
export const Roles = (...roles: RoleValue[]) => SetMetadata(ROLES_KEY, roles)

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentUserPrincipal | undefined =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
)

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokens: AccessTokenService,
  ) {}

  async canActivate(context: ExecutionContext) {
    if (this.isPublic(context)) {
      return true
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const token = this.getBearerToken(request)

    if (token === null) {
      throw new UnauthorizedException('Authentication required')
    }

    try {
      const payload = await this.accessTokens.verify(token)
      request.user = { id: payload.sub, role: payload.role }
      return true
    } catch {
      throw new UnauthorizedException('Authentication required')
    }
  }

  private isPublic(context: ExecutionContext) {
    return (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    )
  }

  private getBearerToken(request: AuthenticatedRequest) {
    const authorization = request.headers?.authorization

    if (authorization === undefined) {
      return null
    }

    const [scheme, token] = authorization.split(' ')

    if (scheme !== 'Bearer' || !token) {
      return null
    }

    return token
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const requiredRoles =
      this.reflector.getAllAndOverride<RoleValue[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? []

    if (requiredRoles.length === 0) {
      return true
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()

    if (request.user === undefined) {
      throw new UnauthorizedException('Authentication required')
    }

    if (!requiredRoles.includes(request.user.role)) {
      throw new ForbiddenException('Insufficient role')
    }

    return true
  }
}
