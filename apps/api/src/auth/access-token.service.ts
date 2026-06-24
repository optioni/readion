import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import type { RoleValue } from '@readion/shared'
import type { EnvConfig } from '../config/env.schema'

export type AccessTokenClaims = {
  sub: string
  role: RoleValue
  iat: number
  exp: number
}

@Injectable()
export class AccessTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvConfig>,
  ) {}

  issue(input: { userId: string; role: RoleValue }) {
    return this.jwt.signAsync(
      { sub: input.userId, role: input.role },
      {
        secret: this.config.getOrThrow('JWT_SECRET', { infer: true }),
        expiresIn: this.config.get('JWT_ACCESS_TOKEN_EXPIRES_IN_SECONDS', { infer: true }) ?? 900,
      },
    )
  }

  verify(token: string) {
    return this.jwt.verifyAsync<AccessTokenClaims>(token, {
      secret: this.config.getOrThrow('JWT_SECRET', { infer: true }),
    })
  }
}
