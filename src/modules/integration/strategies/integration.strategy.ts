import type { EchelonRow } from '@/modules/echelon/echelon.repository';

/**
 * Strategy run when an echelon is closed (Fase 4).
 * Default: enqueue PDF + email jobs. PM/Architecture: stubs.
 */
export type IntegrationStrategy = (
  echelon: EchelonRow,
) => Promise<{ ok: true } | { ok: false; error: Error }>;
