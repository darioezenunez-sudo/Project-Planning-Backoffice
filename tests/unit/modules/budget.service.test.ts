import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BudgetRepository, UsageRecordRow } from '@/modules/budget/budget.repository';
import { createBudgetService } from '@/modules/budget/budget.service';

const ORG_ID = 'org-111';

function makeUsageRecord(overrides: Partial<UsageRecordRow> = {}): UsageRecordRow {
  return {
    id: 'usage-111',
    organizationId: ORG_ID,
    productId: null,
    echelonId: null,
    monthYear: '2026-02',
    tokens: 1000,
    costCents: 50,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    version: 1,
    ...overrides,
  };
}

function makeRepo(overrides: Partial<BudgetRepository> = {}): BudgetRepository {
  return {
    findByOrgAndMonth: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(makeUsageRecord()),
    incrementUsage: vi.fn().mockResolvedValue(makeUsageRecord({ tokens: 2000 })),
    ...overrides,
  };
}

describe('createBudgetService', () => {
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(() => {
    repo = makeRepo();
    vi.clearAllMocks();
  });

  describe('recordUsage', () => {
    it('creates new record when none exists for org/month/product/echelon', async () => {
      vi.mocked(repo.findOne).mockResolvedValue(null);
      vi.mocked(repo.create).mockResolvedValue(makeUsageRecord({ tokens: 500, costCents: 25 }));

      const service = createBudgetService(repo);
      const result = await service.recordUsage(ORG_ID, {
        monthYear: '2026-02',
        tokens: 500,
        costCents: 25,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.tokens).toBe(500);
        expect(result.value.costCents).toBe(25);
      }
      expect(repo.create).toHaveBeenCalledWith(
        ORG_ID,
        expect.objectContaining({
          monthYear: '2026-02',
          tokens: 500,
          costCents: 25,
        }),
      );
      expect(repo.incrementUsage).not.toHaveBeenCalled();
    });

    it('increments existing record when one exists', async () => {
      const existing = makeUsageRecord({ id: 'existing-1', tokens: 1000 });
      vi.mocked(repo.findOne).mockResolvedValue(existing);
      vi.mocked(repo.incrementUsage).mockResolvedValue(
        makeUsageRecord({ id: 'existing-1', tokens: 1500 }),
      );

      const service = createBudgetService(repo);
      const result = await service.recordUsage(ORG_ID, {
        monthYear: '2026-02',
        tokens: 500,
        costCents: 10,
      });

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.tokens).toBe(1500);
      expect(repo.incrementUsage).toHaveBeenCalledWith(existing.id, ORG_ID, 500, 10);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('getUsageByOrgAndMonth', () => {
    it('returns list of usage records', async () => {
      const records = [makeUsageRecord(), makeUsageRecord({ id: 'usage-2' })];
      vi.mocked(repo.findByOrgAndMonth).mockResolvedValue(records);

      const service = createBudgetService(repo);
      const result = await service.getUsageByOrgAndMonth(ORG_ID, '2026-02');

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toHaveLength(2);
    });
  });
});
