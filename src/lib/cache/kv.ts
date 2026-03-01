import { Redis } from '@upstash/redis';

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

let _redis: Redis | null = null;

/**
 * Returns a Redis client when KV env vars are configured,
 * or null to fall back to stub behaviour (dev without Vercel KV).
 */
function getClient(): Redis | null {
  if (_redis) return _redis;

  const url = env.KV_REST_API_URL;
  const token = env.KV_REST_API_TOKEN;

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
