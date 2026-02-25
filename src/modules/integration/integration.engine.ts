import type { EchelonRow } from '@/modules/echelon/echelon.repository';

import type { IntegrationStrategy } from './strategies/integration.strategy';

export type IntegrationEngineDeps = {
  defaultStrategy: IntegrationStrategy;
  pmStrategy: IntegrationStrategy;
  architectureStrategy: IntegrationStrategy;
};

function getBlueprintType(echelon: EchelonRow): string {
  const bp = echelon.configBlueprint;
  if (typeof bp !== 'object' || bp === null || !('type' in bp)) return 'default';
  const t = (bp as { type?: string }).type;
  return typeof t === 'string' ? t : 'default';
}

/**
 * Fase 4: on echelon close, run strategy by config_blueprint.type.
 * MVP: default, pm, architecture → all use same behaviour (PDF + email jobs).
 */
export function createIntegrationEngine(deps: IntegrationEngineDeps) {
  function selectStrategy(type: string): IntegrationStrategy {
    const normalized = type.toLowerCase();
    if (normalized === 'pm') return deps.pmStrategy;
    if (normalized === 'architecture') return deps.architectureStrategy;
    return deps.defaultStrategy;
  }

  async function execute(echelon: EchelonRow): Promise<{ ok: true } | { ok: false; error: Error }> {
    const type = getBlueprintType(echelon);
    const strategy = selectStrategy(type);
    return strategy(echelon);
  }

  return { execute };
}
