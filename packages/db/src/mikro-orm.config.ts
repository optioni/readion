import { join } from 'node:path'
import { defineConfig } from '@mikro-orm/postgresql'
import { PluralUnderscoreNamingStrategy } from './naming-strategy'

export default defineConfig({
  entities: [],
  discovery: { warnWhenNoEntities: false },
  dbName: process.env.DB_NAME ?? 'readion',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER ?? 'readion',
  password: process.env.DB_PASSWORD ?? 'readion',
  namingStrategy: PluralUnderscoreNamingStrategy,
  pool: { min: 2, max: 10 },
  migrations: {
    path: join(__dirname, 'migrations'),
    emit: 'ts',
    snapshot: true,
    transactional: true,
  },
})
