import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import mikroOrmConfig from './mikro-orm.config'
import { PluralUnderscoreNamingStrategy } from './naming-strategy'

describe('MikroORM Config — naming strategy', () => {
  it('uses PluralUnderscoreNamingStrategy', () => {
    expect(mikroOrmConfig.namingStrategy).toBe(PluralUnderscoreNamingStrategy)
  })

  it('converts camelCase property to snake_case column', () => {
    const strategy = new PluralUnderscoreNamingStrategy()
    expect(strategy.propertyToColumnName('createdAt')).toBe('created_at')
  })

  it('converts PascalCase entity class to snake_case plural table', () => {
    const strategy = new PluralUnderscoreNamingStrategy()
    expect(strategy.classToTableName('ContentChunk')).toBe('content_chunks')
  })

  it('resolves host from env with default', () => {
    expect(mikroOrmConfig.host).toBe(process.env.DB_HOST ?? 'localhost')
  })

  it('resolves port from env with default', () => {
    expect(mikroOrmConfig.port).toBe(Number(process.env.DB_PORT ?? 5432))
  })

  it('resolves dbName from env with default', () => {
    expect(mikroOrmConfig.dbName).toBe(process.env.DB_NAME ?? 'readion')
  })

  it('resolves user from env with default', () => {
    expect(mikroOrmConfig.user).toBe(process.env.DB_USER ?? 'readion')
  })

  it('resolves password from env with default', () => {
    expect(mikroOrmConfig.password).toBe(process.env.DB_PASSWORD ?? 'readion')
  })
})

describe('MikroORM Config — migrator settings', () => {
  it('migrations emit format is TypeScript', () => {
    expect(mikroOrmConfig.migrations?.emit).toBe('ts')
  })

  it('migrations snapshot is enabled', () => {
    expect(mikroOrmConfig.migrations?.snapshot).toBe(true)
  })

  it('migrations transactional is enabled', () => {
    expect(mikroOrmConfig.migrations?.transactional).toBe(true)
  })

  it('migrations path points inside packages/db', () => {
    const expectedPath = join(__dirname, 'migrations')
    expect(mikroOrmConfig.migrations?.path).toBe(expectedPath)
  })
})
