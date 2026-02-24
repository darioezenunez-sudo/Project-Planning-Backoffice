import { AppError } from '@/lib/errors/app-error';
import { ErrorCode } from '@/lib/errors/error-codes';
import { err, ok, type Result } from '@/lib/result';
import type {
  CreateEchelonInput,
  ListEchelonsQuery,
  UpdateEchelonInput,
} from '@/schemas/echelon.schema';

import type { EchelonRepository, EchelonRow } from './echelon.repository';
import type { EchelonEvent } from './echelon.state-machine';
import { transitionEchelon } from './echelon.state-machine';
import type { RequiredFieldRepository } from './required-field.repository';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type EchelonDetail = EchelonRow & { readyToClose: boolean };

export type EchelonListResult = {
  items: EchelonRow[];
  nextCursor: string | null;
  hasMore: boolean;
};

// ─── Service factory ───────────────────────────────────────────────────────────

export function createEchelonService(
  repo: EchelonRepository,
  requiredFieldRepo: RequiredFieldRepository,
) {
  async function list(
    organizationId: string,
    query: ListEchelonsQuery,
  ): Promise<Result<EchelonListResult>> {
    const result = await repo.findMany(organizationId, query);
    return ok(result);
  }

  async function getById(id: string, organizationId: string): Promise<Result<EchelonDetail>> {
    const echelon = await repo.findById(id, organizationId);
    if (!echelon) {
      return err(new AppError(ErrorCode.NOT_FOUND, 404, `Echelon ${id} not found`));
    }

    const hasFields = await requiredFieldRepo.hasAny(id, organizationId);
    const readyToClose = hasFields && (await requiredFieldRepo.allMet(id, organizationId));

    return ok({ ...echelon, readyToClose });
  }

  async function create(
    organizationId: string,
    input: CreateEchelonInput,
  ): Promise<Result<EchelonRow>> {
    const echelon = await repo.create(organizationId, input);
    return ok(echelon);
  }

  async function update(
    id: string,
    organizationId: string,
    input: UpdateEchelonInput,
  ): Promise<Result<EchelonRow>> {
    const existing = await repo.findById(id, organizationId);
    if (!existing) {
      return err(new AppError(ErrorCode.NOT_FOUND, 404, `Echelon ${id} not found`));
    }

    const updated = await repo.update(id, organizationId, input);
    if (!updated) {
      return err(
        new AppError(
          ErrorCode.CONFLICT,
          409,
          'Version conflict — the echelon was modified by another request',
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
      return err(new AppError(ErrorCode.NOT_FOUND, 404, `Echelon ${id} not found`));
    }

    const deleted = await repo.softDelete(id, organizationId, version);
    if (!deleted) {
      return err(
        new AppError(
          ErrorCode.CONFLICT,
          409,
          'Version conflict — the echelon was modified by another request',
          { currentVersion: existing.version, requestedVersion: version },
        ),
      );
    }
    return ok(undefined);
  }

  async function consolidate(
    id: string,
    organizationId: string,
    version: number,
  ): Promise<Result<EchelonRow>> {
    const existing = await repo.findById(id, organizationId);
    if (!existing) {
      return err(new AppError(ErrorCode.NOT_FOUND, 404, `Echelon ${id} not found`));
    }

    const transition = transitionEchelon(existing.state, 'CONSOLIDATE');
    if (!transition.ok) return err(transition.error);

    const hasFields = await requiredFieldRepo.hasAny(id, organizationId);
    const allMet = hasFields && (await requiredFieldRepo.allMet(id, organizationId));
    if (!allMet) {
      return err(
        new AppError(
          ErrorCode.UNPROCESSABLE_ENTITY,
          422,
          'Cannot consolidate: not all RequiredFields are met',
          { echelonId: id },
        ),
      );
    }

    const updated = await repo.updateState(id, organizationId, transition.value, version);
    if (!updated) {
      return err(
        new AppError(
          ErrorCode.CONFLICT,
          409,
          'Version conflict — the echelon was modified by another request',
          { currentVersion: existing.version, requestedVersion: version },
        ),
      );
    }
    return ok(updated);
  }

  async function close(
    id: string,
    organizationId: string,
    version: number,
  ): Promise<Result<EchelonRow>> {
    const existing = await repo.findById(id, organizationId);
    if (!existing) {
      return err(new AppError(ErrorCode.NOT_FOUND, 404, `Echelon ${id} not found`));
    }

    const transition = transitionEchelon(existing.state, 'CLOSE');
    if (!transition.ok) return err(transition.error);

    const updated = await repo.updateState(id, organizationId, transition.value, version);
    if (!updated) {
      return err(
        new AppError(
          ErrorCode.CONFLICT,
          409,
          'Version conflict — the echelon was modified by another request',
          { currentVersion: existing.version, requestedVersion: version },
        ),
      );
    }
    return ok(updated);
  }

  async function transition(
    id: string,
    organizationId: string,
    event: EchelonEvent,
    version: number,
  ): Promise<Result<EchelonRow>> {
    const existing = await repo.findById(id, organizationId);
    if (!existing) {
      return err(new AppError(ErrorCode.NOT_FOUND, 404, `Echelon ${id} not found`));
    }

    const fsm = transitionEchelon(existing.state, event);
    if (!fsm.ok) return err(fsm.error);

    const updated = await repo.updateState(id, organizationId, fsm.value, version);
    if (!updated) {
      return err(
        new AppError(
          ErrorCode.CONFLICT,
          409,
          'Version conflict — the echelon was modified by another request',
          { currentVersion: existing.version, requestedVersion: version },
        ),
      );
    }
    return ok(updated);
  }

  return { list, getById, create, update, remove, consolidate, close, transition };
}

export type EchelonService = ReturnType<typeof createEchelonService>;
