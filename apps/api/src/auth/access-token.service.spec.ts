import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import type { EnvConfig } from '../config/env.schema'
import { AccessTokenService } from './access-token.service'

describe('AccessTokenService', () => {
  it('issues and verifies short-lived access tokens with subject and role claims', async () => {
    const service = new AccessTokenService(
      new JwtService(),
      new ConfigService<EnvConfig>({
        JWT_SECRET: 'test-secret-with-at-least-32-characters',
        JWT_ACCESS_TOKEN_EXPIRES_IN_SECONDS: 900,
      } as EnvConfig),
    )

    const token = await service.issue({ userId: 'user-1', role: 'admin' })
    const payload = await service.verify(token)

    expect(payload.sub).toBe('user-1')
    expect(payload.role).toBe('admin')
    expect(payload.exp - payload.iat).toBe(900)
    await expect(service.verify('not-a-jwt')).rejects.toThrow()
  })

  it('rejects expired access tokens', async () => {
    const service = new AccessTokenService(
      new JwtService(),
      new ConfigService<EnvConfig>({
        JWT_SECRET: 'test-secret-with-at-least-32-characters',
        JWT_ACCESS_TOKEN_EXPIRES_IN_SECONDS: -1,
      } as EnvConfig),
    )

    const token = await service.issue({ userId: 'user-1', role: 'user' })

    await expect(service.verify(token)).rejects.toThrow()
  })
})
