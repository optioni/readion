import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common'
import Redis from 'ioredis'

export const REDIS_CLIENT = Symbol('REDIS_CLIENT')

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => {
        // Read directly from process.env so integration tests can set the URL
        // in beforeAll before compile() runs, without ConfigService caching issues.
        const url = process.env.REDIS_URL
        if (!url) throw new Error('REDIS_URL is not set')
        return new Redis(url)
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleDestroy() {
    await this.redis.quit()
  }
}
