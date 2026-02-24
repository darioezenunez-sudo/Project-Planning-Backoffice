import { AppError } from '@/lib/errors/app-error';
import { ErrorCode } from '@/lib/errors/error-codes';
import { err, ok, type Result } from '@/lib/result';
import type { RecordUsageInput } from '@/schemas/usage.schema';

import type { BudgetRepository, UsageRecordRow } from './budget.repository';

// ─── Service factory ───────────────────────────────────────────────────────────

export function createBudgetService(repo: BudgetRepository) {
  async function recordUsage(
    organizationId: string,
    input: RecordUsageInput,
  ): Promise<Result<UsageRecordRow>> {
    const productId = input.productId ?? null;
    const echelonId = input.echelonId ?? null;

    const existing = await repo.findOne(organizationId, input.monthYear, productId, echelonId);

    if (existing !== null) {
      const updated = await repo.incrementUsage(
        existing.id,
        organizationId,
        input.tokens,
        input.costCents,
      );
      if (updated === null) {
        return err(new AppError(ErrorCode.INTERNAL_ERROR, 500, 'Failed to increment usage'));
      }
      return ok(updated);
    }

    const created = await repo.create(organizationId, input);
    return ok(created);
  }

  async function getUsageByOrgAndMonth(
    organizationId: string,
    monthYear: string,
  ): Promise<Result<UsageRecordRow[]>> {
    const records = await repo.findByOrgAndMonth(organizationId, monthYear);
    return ok(records);
  }

  return { recordUsage, getUsageByOrgAndMonth };
}

export type BudgetService = ReturnType<typeof createBudgetService>;
