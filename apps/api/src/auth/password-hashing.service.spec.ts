import { ConfigService } from '@nestjs/config'
import type { EnvConfig } from '../config/env.schema'
import { PasswordHashingService } from './password-hashing.service'

describe('PasswordHashingService', () => {
  it('hashes plaintext with bcrypt and verifies correct and incorrect passwords', async () => {
    const service = new PasswordHashingService(
      new ConfigService<EnvConfig>({ BCRYPT_COST: 4 } as EnvConfig),
    )

    const hash = await service.hash('correcthorse')

    expect(hash).not.toBe('correcthorse')
    expect(hash).toMatch(/^\$2/)
    await expect(service.verify('correcthorse', hash)).resolves.toBe(true)
    await expect(service.verify('wrong-password', hash)).resolves.toBe(false)
  })
})
