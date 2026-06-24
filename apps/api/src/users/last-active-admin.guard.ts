import { EntityManager } from '@mikro-orm/core'
import { ConflictException, Injectable } from '@nestjs/common'
import { User, UserRole } from '@readion/db'

@Injectable()
export class LastActiveAdminGuard {
  async assertCanDelete(user: User, em: EntityManager) {
    if (user.role !== UserRole.Admin) {
      return
    }

    const activeAdmins = await em.count(User, { role: UserRole.Admin, deletedAt: null })

    if (activeAdmins <= 1) {
      throw new ConflictException('Cannot delete the last active admin')
    }
  }
}
