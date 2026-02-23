import { AppError } from '@/lib/errors/app-error';
import { ErrorCode } from '@/lib/errors/error-codes';
import { err, ok, type Result } from '@/lib/result';
import type {
  CreateProductInput,
  ListProductsQuery,
  UpdateProductInput,
} from '@/schemas/product.schema';

import type { ProductRepository, ProductRow } from './product.repository';

export type ProductListResult = {
  items: ProductRow[];
  nextCursor: string | null;
  hasMore: boolean;
};

export function createProductService(repo: ProductRepository) {
  async function list(
    organizationId: string,
    query: ListProductsQuery,
  ): Promise<Result<ProductListResult>> {
    return ok(await repo.findMany(organizationId, query));
  }

  async function getById(id: string, organizationId: string): Promise<Result<ProductRow>> {
    const product = await repo.findById(id, organizationId);
    if (!product) {
      return err(new AppError(ErrorCode.NOT_FOUND, 404, `Product ${id} not found`));
    }
    return ok(product);
  }

  async function create(
    organizationId: string,
    input: CreateProductInput,
  ): Promise<Result<ProductRow>> {
    return ok(await repo.create(organizationId, input));
  }

  async function update(
    id: string,
    organizationId: string,
    input: UpdateProductInput,
  ): Promise<Result<ProductRow>> {
    const existing = await repo.findById(id, organizationId);
    if (!existing) {
      return err(new AppError(ErrorCode.NOT_FOUND, 404, `Product ${id} not found`));
    }

    const updated = await repo.update(id, organizationId, input);
    if (!updated) {
      return err(
        new AppError(ErrorCode.CONFLICT, 409, 'Version conflict', {
          currentVersion: existing.version,
          requestedVersion: input.version,
        }),
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
      return err(new AppError(ErrorCode.NOT_FOUND, 404, `Product ${id} not found`));
    }

    const deleted = await repo.softDelete(id, organizationId, version);
    if (!deleted) {
      return err(
        new AppError(ErrorCode.CONFLICT, 409, 'Version conflict', {
          currentVersion: existing.version,
          requestedVersion: version,
        }),
      );
    }
    return ok(undefined);
  }

  return { list, getById, create, update, remove };
}

export type ProductService = ReturnType<typeof createProductService>;
