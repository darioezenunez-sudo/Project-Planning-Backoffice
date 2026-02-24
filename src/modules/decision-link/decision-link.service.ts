import { AppError } from '@/lib/errors/app-error';
import { ErrorCode } from '@/lib/errors/error-codes';
import { err, ok, type Result } from '@/lib/result';
import type { CreateDecisionLinkInput, UpdateDecisionLinkInput } from '@/schemas/echelon.schema';

import type { DecisionLinkRepository, DecisionLinkRow } from './decision-link.repository';

// ─── Service factory ───────────────────────────────────────────────────────────

export function createDecisionLinkService(repo: DecisionLinkRepository) {
  async function listByRequiredField(
    requiredFieldId: string,
    organizationId: string,
  ): Promise<Result<DecisionLinkRow[]>> {
    const links = await repo.findManyByRequiredField(requiredFieldId, organizationId);
    return ok(links);
  }

  async function listByExecutiveSummary(
    executiveSummaryId: string,
    organizationId: string,
  ): Promise<Result<DecisionLinkRow[]>> {
    const links = await repo.findManyByExecutiveSummary(executiveSummaryId, organizationId);
    return ok(links);
  }

  async function getById(id: string, organizationId: string): Promise<Result<DecisionLinkRow>> {
    const link = await repo.findById(id, organizationId);
    if (!link) {
      return err(new AppError(ErrorCode.NOT_FOUND, 404, `DecisionLink ${id} not found`));
    }
    return ok(link);
  }

  async function create(
    organizationId: string,
    input: CreateDecisionLinkInput,
  ): Promise<Result<DecisionLinkRow>> {
    const link = await repo.create(organizationId, input);
    return ok(link);
  }

  async function update(
    id: string,
    organizationId: string,
    input: UpdateDecisionLinkInput,
  ): Promise<Result<DecisionLinkRow>> {
    const existing = await repo.findById(id, organizationId);
    if (!existing) {
      return err(new AppError(ErrorCode.NOT_FOUND, 404, `DecisionLink ${id} not found`));
    }

    const updated = await repo.update(id, organizationId, input);
    if (!updated) {
      return err(
        new AppError(
          ErrorCode.CONFLICT,
          409,
          'Version conflict — the decision link was modified by another request',
          { currentVersion: existing.version, requestedVersion: input.version },
        ),
      );
    }
    return ok(updated);
  }

  async function remove(
    id: string,
    organizationId: string,
    version: number,
  ): Promise<Result<void>> {
    const existing = await repo.findById(id, organizationId);
    if (!existing) {
      return err(new AppError(ErrorCode.NOT_FOUND, 404, `DecisionLink ${id} not found`));
    }

    const deleted = await repo.softDelete(id, organizationId, version);
    if (!deleted) {
      return err(
        new AppError(
          ErrorCode.CONFLICT,
          409,
          'Version conflict — the decision link was modified by another request',
          { currentVersion: existing.version, requestedVersion: version },
        ),
      );
    }
    return ok(undefined);
  }

  return {
    listByRequiredField,
    listByExecutiveSummary,
    getById,
    create,
    update,
    remove,
  };
}

export type DecisionLinkService = ReturnType<typeof createDecisionLinkService>;
