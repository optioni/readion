export interface RedisEvictClient {
  smembers(key: string): Promise<string[]>
  del(arg1: string, ...args: string[]): Promise<number>
}

export function chunkReverseIndexKey(chunkId: string): string {
  return `chunk:${chunkId}`
}

export async function evictByChunkId(redis: RedisEvictClient, chunkId: string): Promise<void> {
  const indexKey = chunkReverseIndexKey(chunkId)
  const cacheKeys = await redis.smembers(indexKey)
  const keysToDelete = cacheKeys.length > 0 ? [indexKey, ...cacheKeys] : [indexKey]
  await redis.del(keysToDelete[0]!, ...keysToDelete.slice(1))
}
