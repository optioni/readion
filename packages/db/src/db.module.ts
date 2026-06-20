import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Global, Module } from '@nestjs/common'
import mikroOrmConfig from './mikro-orm.config'

@Global()
@Module({
  imports: [
    MikroOrmModule.forRootAsync({
      useFactory: () => ({
        ...mikroOrmConfig,
        dbName: process.env.DB_NAME ?? 'readion',
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 5432),
        user: process.env.DB_USER ?? 'readion',
        password: process.env.DB_PASSWORD ?? 'readion',
      }),
    }),
  ],
})
export class DbModule {}
