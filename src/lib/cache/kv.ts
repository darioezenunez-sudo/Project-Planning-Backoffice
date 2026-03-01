import { Redis } from '@upstash/redis';

import { logger } from '@/lib/logger';

let _redis: Redis | null = null;

/**
 * Returns an Upstash Redis client when env vars are configured,
 * or null to fall back to stub behaviour (dev without Redis).
 *
 * Vercel + Upstash for Redis (prefix "UPSTASH_REDIS_REST") injects:
 *   UPSTASH_REDIS_REST_KV_REST_API_URL   — REST endpoint
 *   UPSTASH_REDIS_REST_KV_REST_API_TOKEN — bearer token
 */
function getClient(): Redis | null {
  if (_redis) return _redis;

  const url = process.env.UPSTASH_REDIS_REST_KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;

  if (!url || !token) return null;

  try {
    _redis = new Redis({ url, token });
    return _redis;
  } catch (err) {
    logger.warn({ err }, 'kv: failed to create Redis client');
    return null;
  }
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
