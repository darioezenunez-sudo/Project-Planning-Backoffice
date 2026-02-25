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
 */
export async function invalidateContextCache(echelonId: string): Promise<void> {
  await kvDel(getContextCacheKey(echelonId));
}

/**
 * Call after a summary state transition; invalidates cache only when new state is VALIDATED.
 */
export async function invalidateContextCacheIfValidated(summary: {
  state: string;
  echelonId: string;
}): Promise<void> {
  if (summary.state === 'VALIDATED') {
    await invalidateContextCache(summary.echelonId);
  }
}
