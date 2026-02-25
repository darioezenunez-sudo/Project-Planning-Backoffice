import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EchelonRow } from '@/modules/echelon/echelon.repository';
import { createIntegrationEngine } from '@/modules/integration/integration.engine';

function makeEchelon(overrides: Partial<EchelonRow> = {}): EchelonRow {
  return {
    id: 'ech-1',
    organizationId: 'org-1',
    productId: 'prod-1',
    name: 'Echelon Alpha',
    state: 'CLOSED',
    configBlueprint: null,
    consolidatedReport: null,
    consolidatedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    version: 1,
    ...overrides,
  };
}

describe('createIntegrationEngine', () => {
  const defaultStrategy = vi.fn().mockResolvedValue({ ok: true });
  const pmStrategy = vi.fn().mockResolvedValue({ ok: true });
  const architectureStrategy = vi.fn().mockResolvedValue({ ok: true });

  const engine = createIntegrationEngine({
    defaultStrategy,
    pmStrategy,
    architectureStrategy,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selects default strategy when configBlueprint has no type', async () => {
    const echelon = makeEchelon({ configBlueprint: null });
    await engine.execute(echelon);
    expect(defaultStrategy).toHaveBeenCalledWith(echelon);
    expect(pmStrategy).not.toHaveBeenCalled();
    expect(architectureStrategy).not.toHaveBeenCalled();
  });

  it('selects default strategy when configBlueprint.type is "default"', async () => {
    const echelon = makeEchelon({
      configBlueprint: { type: 'default' },
    });
    await engine.execute(echelon);
    expect(defaultStrategy).toHaveBeenCalledWith(echelon);
  });

  it('selects pm strategy when configBlueprint.type is "pm"', async () => {
    const echelon = makeEchelon({ configBlueprint: { type: 'pm' } });
    await engine.execute(echelon);
    expect(pmStrategy).toHaveBeenCalledWith(echelon);
    expect(defaultStrategy).not.toHaveBeenCalled();
  });

  it('selects architecture strategy when configBlueprint.type is "architecture"', async () => {
    const echelon = makeEchelon({
      configBlueprint: { type: 'architecture' },
    });
    await engine.execute(echelon);
    expect(architectureStrategy).toHaveBeenCalledWith(echelon);
    expect(defaultStrategy).not.toHaveBeenCalled();
  });

  it('returns strategy result', async () => {
    const echelon = makeEchelon();
    const result = await engine.execute(echelon);
    expect(result).toEqual({ ok: true });
  });

  it('returns error when strategy fails', async () => {
    const err = new Error('PDF failed');
    defaultStrategy.mockResolvedValueOnce({ ok: false, error: err });
    const echelon = makeEchelon();
    const result = await engine.execute(echelon);
    expect(result).toEqual({ ok: false, error: err });
  });
});
