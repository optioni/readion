import type { FilterQuery } from '@mikro-orm/core'
import { NotFoundException } from '@nestjs/common'

interface MikroOrmRepository<T extends object> {
  findOne(where: FilterQuery<T>): Promise<T | null>
}

const DEFAULT_OWNER_FIELD = 'userId'
const DEFAULT_NOT_FOUND_MESSAGE = 'Resource not found'

export function withUserScope<T extends object>(
  userId: string,
  where: FilterQuery<T>,
  ownerField: string = DEFAULT_OWNER_FIELD,
): FilterQuery<T> {
  return {
    $and: [where, { [ownerField]: userId } as FilterQuery<T>],
  } as FilterQuery<T>
}

export class UserScopedRepository<T extends object> {
  constructor(
    private readonly repository: MikroOrmRepository<T>,
    private readonly ownerField: string = DEFAULT_OWNER_FIELD,
  ) {}

  async findOneOrFail(
    userId: string,
    where: FilterQuery<T>,
    notFoundMessage: string = DEFAULT_NOT_FOUND_MESSAGE,
  ): Promise<T> {
    const entity = await this.repository.findOne(withUserScope(userId, where, this.ownerField))

    if (entity === null) {
      throw new NotFoundException(notFoundMessage)
    }

    return entity
  }
}
