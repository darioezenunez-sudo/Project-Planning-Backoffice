import { AppError } from '@/lib/errors/app-error';
import { ErrorCode } from '@/lib/errors/error-codes';
import { err, ok, type Result } from '@/lib/result';
import type { CreateRequiredFieldInput, UpdateRequiredFieldInput } from '@/schemas/echelon.schema';

import type { RequiredFieldRepository, RequiredFieldRow } from './required-field.repository';

// ─── Service factory ───────────────────────────────────────────────────────────

export function createRequiredFieldService(repo: RequiredFieldRepository) {
  async function listByEchelon(
    echelonId: string,
    organizationId: string,
  ): Promise<Result<RequiredFieldRow[]>> {
    const fields = await repo.findManyByEchelon(echelonId, organizationId);
    return ok(fields);
  }

  async function getById(id: string, organizationId: string): Promise<Result<RequiredFieldRow>> {
    const field = await repo.findById(id, organizationId);
    if (!field) {
      return err(new AppError(ErrorCode.NOT_FOUND, 404, `RequiredField ${id} not found`));
    }
    return ok(field);
  }

  async function create(
    echelonId: string,
    organizationId: string,
    input: CreateRequiredFieldInput,
  ): Promise<Result<RequiredFieldRow>> {
    const field = await repo.create(echelonId, organizationId, input);
    return ok(field);
  }

  async function update(
    id: string,
    organizationId: string,
    input: UpdateRequiredFieldInput,
  ): Promise<Result<RequiredFieldRow>> {
    const existing = await repo.findById(id, organizationId);
    if (!existing) {
      return err(new AppError(ErrorCode.NOT_FOUND, 404, `RequiredField ${id} not found`));
    }

    const updated = await repo.update(id, organizationId, input);
    if (!updated) {
      return err(
        new AppError(
          ErrorCode.CONFLICT,
          409,
          'Version conflict — the required field was modified by another request',
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
      return err(new AppError(ErrorCode.NOT_FOUND, 404, `RequiredField ${id} not found`));
    }

    const deleted = await repo.softDelete(id, organizationId, version);
    if (!deleted) {
      return err(
        new AppError(
          ErrorCode.CONFLICT,
          409,
          'Version conflict — the required field was modified by another request',
          { currentVersion: existing.version, requestedVersion: version },
        ),
      );
    }
    return ok(undefined);
  }

  return { listByEchelon, getById, create, update, remove };
}

export type RequiredFieldService = ReturnType<typeof createRequiredFieldService>;
