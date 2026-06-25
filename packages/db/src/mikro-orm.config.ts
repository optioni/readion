import { join } from 'node:path'
import { defineConfig } from '@mikro-orm/postgresql'
import { CertificationSchema } from './entities/certification.entity'
import { ContentChunkSchema } from './entities/content-chunk.entity'
import { ContentSourceSchema } from './entities/content-source.entity'
import { QuizResponseSchema } from './entities/quiz-response.entity'
import { UserSchema } from './entities/user.entity'
import { UserCertificationSchema } from './entities/user-certification.entity'
import { PluralUnderscoreNamingStrategy } from './naming-strategy'

export default defineConfig({
  entities: [
    UserSchema,
    CertificationSchema,
    UserCertificationSchema,
    ContentSourceSchema,
    ContentChunkSchema,
    QuizResponseSchema,
  ],
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
