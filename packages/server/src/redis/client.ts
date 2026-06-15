import { Redis } from 'ioredis'

export function createRedis(redisUrl: string) {
  return new Redis(redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true })
}
export const PAIR_CODE_PREFIX = 'pair:'
export const DEVICE_ONLINE_PREFIX = 'device:online:'

export const PAIR_CODE_TTL_SECONDS = 600
export const DEVICE_ONLINE_TTL_SECONDS = 90
