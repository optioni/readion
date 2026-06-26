import { EntityManager } from '@mikro-orm/core'
import { Injectable } from '@nestjs/common'
import { SessionItem } from '@readion/db'
import type { ItemProvenance, ProvenancePort } from './agent-tools.types'

@Injectable()
export class SessionItemProvenanceReader implements ProvenancePort {
  constructor(private readonly em: EntityManager) {}

  async findOwnedProvenance(
    userId: string,
    sessionId: string,
    itemIndex: number,
  ): Promise<ItemProvenance | null> {
    const em = this.em.fork()
    const item = await em.findOne(SessionItem, {
      index: itemIndex,
      session: { id: sessionId, user: userId },
    })
    if (item === null) {
      return null
    }
    return {
      content: item.content,
      sourceChunkIds: item.sourceChunkIds,
      supportingSpans: item.supportingSpans,
    }
  }
}
