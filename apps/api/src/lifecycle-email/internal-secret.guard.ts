import { timingSafeEqual } from 'node:crypto'
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { EnvConfig } from '../config/env.schema'

// The worker sends the shared secret on this header; it must match the literal the
// worker uses (`apps/worker/src/lifecycle-email/lifecycle-api.client.ts`). The API
// package cannot import from the worker package.
export const INTERNAL_API_SECRET_HEADER = 'x-internal-api-secret'

type GuardedRequest = {
  headers?: Record<string, string | string[] | undefined>
}

@Injectable()
export class InternalSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService<EnvConfig>) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<GuardedRequest>()
    const provided = request.headers?.[INTERNAL_API_SECRET_HEADER]
    const expected = this.config.getOrThrow('INTERNAL_API_SECRET', { infer: true })

    if (typeof provided !== 'string' || !secretsMatch(provided, expected)) {
      throw new UnauthorizedException('Invalid internal secret')
    }

    return true
  }
}

function secretsMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided)
  const expectedBuffer = Buffer.from(expected)
  if (providedBuffer.length !== expectedBuffer.length) {
    return false
  }
  return timingSafeEqual(providedBuffer, expectedBuffer)
}
