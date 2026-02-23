import { AppError } from '@/lib/errors/app-error';
import { ErrorCode } from '@/lib/errors/error-codes';
import { err, ok, type Result } from '@/lib/result';
import type {
  CreateCompanyInput,
  ListCompaniesQuery,
  UpdateCompanyInput,
} from '@/schemas/company.schema';

import type { CompanyRepository, CompanyRow } from './company.repository';

export type CompanyListResult = {
  items: CompanyRow[];
  nextCursor: string | null;
  hasMore: boolean;
};

export function createCompanyService(repo: CompanyRepository) {
  async function list(
    organizationId: string,
    query: ListCompaniesQuery,
  ): Promise<Result<CompanyListResult>> {
    const result = await repo.findMany(organizationId, query);
    return ok(result);
  }

  async function getById(id: string, organizationId: string): Promise<Result<CompanyRow>> {
    const company = await repo.findById(id, organizationId);
    if (!company) {
      return err(new AppError(ErrorCode.NOT_FOUND, 404, `Company ${id} not found`));
    }
    return ok(company);
  }

  async function create(
    organizationId: string,
    input: CreateCompanyInput,
  ): Promise<Result<CompanyRow>> {
    const company = await repo.create(organizationId, input);
    return ok(company);
  }

  async function update(
    id: string,
    organizationId: string,
    input: UpdateCompanyInput,
  ): Promise<Result<CompanyRow>> {
    // Verify exists first to give a clear 404 vs 409.
    const existing = await repo.findById(id, organizationId);
    if (!existing) {
      return err(new AppError(ErrorCode.NOT_FOUND, 404, `Company ${id} not found`));
    }

    const updated = await repo.update(id, organizationId, input);
    if (!updated) {
      return err(
        new AppError(
          ErrorCode.CONFLICT,
          409,
          'Version conflict — the company was modified by another request',
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
      return err(new AppError(ErrorCode.NOT_FOUND, 404, `Company ${id} not found`));
    }

    const deleted = await repo.softDelete(id, organizationId, version);
    if (!deleted) {
      return err(
        new AppError(
          ErrorCode.CONFLICT,
          409,
          'Version conflict — the company was modified by another request',
          { currentVersion: existing.version, requestedVersion: version },
        ),
      );
    }
    return ok(undefined);
  }

  return { list, getById, create, update, remove };
}

export type CompanyService = ReturnType<typeof createCompanyService>;
