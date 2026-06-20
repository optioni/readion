export interface RelationshipRef<R = unknown> {
  href: string
  data?: R | R[] | null
}

export interface CollectionMeta {
  total: number
  page: number
  limit: number
}

export interface SingleResourceEnvelope<T> {
  data: T
  relationships?: Record<string, RelationshipRef>
}

export interface CollectionEnvelope<T> {
  data: T[]
  meta: CollectionMeta
}
