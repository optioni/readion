import { Global, Module } from '@nestjs/common'
import { ScrapperClient } from './scrapper.client'

export const SCRAPPER_CLIENT = Symbol('SCRAPPER_CLIENT')

@Global()
@Module({
  providers: [
    {
      provide: SCRAPPER_CLIENT,
      useFactory: () => {
        const baseUrl = process.env.SCRAPPER_URL
        if (!baseUrl) throw new Error('SCRAPPER_URL is not set')
        return new ScrapperClient(baseUrl)
      },
    },
  ],
  exports: [SCRAPPER_CLIENT],
})
export class ScrapperModule {}
