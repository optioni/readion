import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import bcrypt from 'bcrypt'
import type { EnvConfig } from '../config/env.schema'

@Injectable()
export class PasswordHashingService {
  constructor(private readonly config: ConfigService<EnvConfig>) {}

  async hash(password: string) {
    return bcrypt.hash(password, this.config.get('BCRYPT_COST', { infer: true }) ?? 12)
  }

  async verify(password: string, hash: string) {
    return bcrypt.compare(password, hash)
  }
}
