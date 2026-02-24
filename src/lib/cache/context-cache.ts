/**
 * Context bundle cache (Fase 3).
 * Key: ctx:{echelonId}. Invalidated when RequiredFields or summaries change (see ROADMAP Fase 3).
 */
import { kvDel, kvGet, kvSet } from './kv';

const KEY_PREFIX = 'ctx:';
const TTL_SECONDS = 300; // 5 min

export function getContextCacheKey(echelonId: string): string {
  return `${KEY_PREFIX}${echelonId}`;
}

export async function getContextBundleFromCache(echelonId: string): Promise<unknown> {
  return kvGet(getContextCacheKey(echelonId));
}

export async function setContextBundleCache(
  echelonId: string,
  bundle: unknown,
  ttlSeconds = TTL_SECONDS,
): Promise<void> {
  await kvSet(getContextCacheKey(echelonId), bundle, ttlSeconds);
}

/**
 * Call when context becomes stale: RequiredField updated, or summary validated.
 * Also call from any route that transitions a summary to VALIDATED (when that route exists).
 */
export async function invalidateContextCache(echelonId: string): Promise<void> {
  await kvDel(getContextCacheKey(echelonId));
}
