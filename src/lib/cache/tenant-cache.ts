/**
 * Caché de membresía organizacional para withTenant.
 * Key: tenant:{userId}:{organizationId}
 * TTL: 120 s — permite detectar cambios de rol en máximo 2 min.
 *
 * Fallback graceful: si kvGet retorna null (Redis no disponible),
 * withTenant cae a la DB sin error. No hay regresión funcional.
 */
import { kvDel, kvGet, kvSet } from './kv';

const KEY_PREFIX = 'tenant:';
const TTL_SECONDS = 120;

export function getTenantCacheKey(userId: string, organizationId: string): string {
  return `${KEY_PREFIX}${userId}:${organizationId}`;
}

export async function getTenantMemberFromCache(
  userId: string,
  organizationId: string,
): Promise<{ role: string } | null> {
  try {
    return await kvGet<{ role: string }>(getTenantCacheKey(userId, organizationId));
  } catch {
    return null;
  }
}

export async function setTenantMemberCache(
  userId: string,
  organizationId: string,
  role: string,
): Promise<void> {
  await kvSet(getTenantCacheKey(userId, organizationId), { role }, TTL_SECONDS);
}

export async function invalidateTenantMemberCache(
  userId: string,
  organizationId: string,
): Promise<void> {
  await kvDel(getTenantCacheKey(userId, organizationId));
}
