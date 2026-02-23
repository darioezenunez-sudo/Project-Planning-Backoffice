/** Stub — Vercel KV en Fase 0.16 */
export async function kvGet<T>(_key: string): Promise<T | null> {
  return null;
}
export async function kvSet(_key: string, _value: unknown, _ttlSeconds?: number): Promise<void> {}
export async function kvDel(_key: string): Promise<void> {}
