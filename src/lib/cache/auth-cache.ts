/**
 * Caché de validación de tokens Bearer para withAuth.
 * Aplica EXCLUSIVAMENTE al canal Bearer (Electron App / Data Plane).
 * El canal de cookies NO se cachea — el token rota en cada refresh.
 *
 * Key: auth:{sha256(token)[0:24]} — prefijo del hash, nunca el token raw.
 * TTL: 60 s — los tokens de Supabase duran 1 h por defecto;
 *             cualquier token inválido expira del caché en máximo 60 s.
 *
 * Implicación de seguridad: un token revocado manualmente permanece
 * válido en caché hasta el TTL (máx 60 s). Aceptable para un backoffice
 * interno de acceso controlado donde la revocación manual es excepcional.
 *
 * Invalidación: llamar invalidateAuthCache(token) en POST /api/v1/auth/logout
 * cuando ese endpoint exista (p. ej. para el Electron App).
 */
import { createHash } from 'node:crypto';

import { kvDel, kvGet, kvSet } from './kv';

const KEY_PREFIX = 'auth:';
const TTL_SECONDS = 60;

function tokenCacheKey(token: string): string {
  const digest = createHash('sha256').update(token).digest('hex');
  return `${KEY_PREFIX}${digest.slice(0, 24)}`;
}

export async function getUserIdFromAuthCache(token: string): Promise<string | null> {
  return kvGet<string>(tokenCacheKey(token));
}

export async function setAuthCache(token: string, userId: string): Promise<void> {
  await kvSet(tokenCacheKey(token), userId, TTL_SECONDS);
}

export async function invalidateAuthCache(token: string): Promise<void> {
  await kvDel(tokenCacheKey(token));
}
