import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { parseEnv } from './env.schema'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env: Record<string, string | undefined>) => parseEnv(env),
    }),
  ],
})
export class ApiConfigModule {}
