import { UnderscoreNamingStrategy } from '@mikro-orm/core'

export class PluralUnderscoreNamingStrategy extends UnderscoreNamingStrategy {
  override classToTableName(entityName: string): string {
    const snake = super.classToTableName(entityName)
    return snake.endsWith('s') ? snake : `${snake}s`
  }
}
