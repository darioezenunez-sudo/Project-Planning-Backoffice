import { Redis } from '@upstash/redis';

import { logger } from '@/lib/logger';

let _redis: Redis | null = null;

/**
 * Returns an Upstash Redis client when env vars are configured,
 * or null to fall back to stub behaviour (dev without Redis).
 *
 * Vercel + Upstash for Redis injects:
 *   UPSTASH_REDIS_REST_URL   — REST endpoint
 *   UPSTASH_REDIS_REST_TOKEN — bearer token
 */
function getClient(): Redis | null {
  if (_redis) return _redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  _redis = new Redis({ url, token });
  return _redis;
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const client = getClient();
  if (!client) return null;
  try {
    return await client.get<T>(key);
  } catch (err) {
    logger.warn({ err, key }, 'kvGet failed');
    return null;
  }
}

export async function kvSet(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  const client = getClient();
  if (!client) return;
  try {
    if (ttlSeconds != null) {
      await client.set(key, value, { ex: ttlSeconds });
    } else {
      await client.set(key, value);
    }
  } catch (err) {
    logger.warn({ err, key }, 'kvSet failed');
  }
}

export async function kvDel(key: string): Promise<void> {
  const client = getClient();
  if (!client) return;
  try {
    await client.del(key);
  } catch (err) {
    logger.warn({ err, key }, 'kvDel failed');
  }
}
