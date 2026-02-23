import { AppError } from '@/lib/errors/app-error';
import { ErrorCode } from '@/lib/errors/error-codes';
import { err, ok, type Result } from '@/lib/result';
import type {
  CreateOrganizationInput,
  UpdateOrganizationInput,
} from '@/schemas/organization.schema';

import type { OrganizationRecord, OrganizationRepository } from './organization.repository';

export function createOrganizationService(repo: OrganizationRepository) {
  async function getById(id: string): Promise<Result<OrganizationRecord>> {
    const org = await repo.findById(id);
    if (!org) {
      return err(new AppError(ErrorCode.NOT_FOUND, 404, 'Organization not found', { id }));
    }
    return ok(org);
  }

  async function create(input: CreateOrganizationInput): Promise<Result<OrganizationRecord>> {
    const existing = await repo.findBySlug(input.slug);
    if (existing) {
      return err(
        new AppError(ErrorCode.CONFLICT, 409, 'An organization with this slug already exists', {
          slug: input.slug,
        }),
      );
    }
    const org = await repo.create({ name: input.name, slug: input.slug });
    return ok(org);
  }

  async function update(
    id: string,
    input: UpdateOrganizationInput,
  ): Promise<Result<OrganizationRecord>> {
    const { version, ...data } = input;
    const updated = await repo.update(id, version, data);
    if (!updated) {
      return err(
        new AppError(ErrorCode.CONFLICT, 409, 'Organization was modified by another request', {
          id,
          version,
        }),
      );
    }
    return ok(updated);
  }

  async function remove(id: string, version: number): Promise<Result<void>> {
    const deleted = await repo.softDelete(id, version);
    if (!deleted) {
      return err(
        new AppError(ErrorCode.CONFLICT, 409, 'Organization was modified by another request', {
          id,
          version,
        }),
      );
    }
    return ok(undefined);
  }

  return { getById, create, update, remove };
}

export type OrganizationService = ReturnType<typeof createOrganizationService>;
