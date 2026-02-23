import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '@/lib/errors/app-error';

import { createProductService } from '@/modules/product/product.service';
import type { ProductRepository } from '@/modules/product/product.repository';

const makeRepo = (): ProductRepository => ({
  findById: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
});

const ORG_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const baseProduct = {
  id: '22222222-2222-2222-2222-222222222222',
  organizationId: ORG_ID,
  companyId: '33333333-3333-3333-3333-333333333333',
  name: 'Widget Pro',
  description: null,
  sku: null,
  unitPrice: null,
  currency: 'USD',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  version: 1,
};

describe('productService', () => {
  let repo: ProductRepository;
  let service: ReturnType<typeof createProductService>;

  beforeEach(() => {
    repo = makeRepo();
    service = createProductService(repo);
  });

  describe('getById', () => {
    it('returns ok with product when found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(baseProduct);

      const result = await service.getById(baseProduct.id, ORG_ID);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.name).toBe('Widget Pro');
    });

    it('returns err(404) when product does not exist', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);

      const result = await service.getById('missing', ORG_ID);

      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(404);
    });
  });

  describe('create', () => {
    it('creates and returns the new product', async () => {
      vi.mocked(repo.create).mockResolvedValue(baseProduct);

      const result = await service.create(ORG_ID, {
        companyId: baseProduct.companyId,
        name: 'Widget Pro',
      });

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.name).toBe('Widget Pro');
    });
  });

  describe('update', () => {
    it('returns ok with updated product on success', async () => {
      const updated = { ...baseProduct, name: 'Widget Ultra', version: 2 };
      vi.mocked(repo.findById).mockResolvedValue(baseProduct);
      vi.mocked(repo.update).mockResolvedValue(updated);

      const result = await service.update(baseProduct.id, ORG_ID, {
        name: 'Widget Ultra',
        version: 1,
      });

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.name).toBe('Widget Ultra');
    });

    it('returns err(404) when product does not exist', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);

      const result = await service.update('missing', ORG_ID, { name: 'Widget Ultra', version: 1 });

      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(404);
    });

    it('returns err(409) when version mismatch', async () => {
      vi.mocked(repo.findById).mockResolvedValue(baseProduct);
      vi.mocked(repo.update).mockResolvedValue(null);

      const result = await service.update(baseProduct.id, ORG_ID, {
        name: 'Widget Ultra',
        version: 99,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(409);
    });
  });

  describe('remove', () => {
    it('returns ok(undefined) on successful soft-delete', async () => {
      vi.mocked(repo.findById).mockResolvedValue(baseProduct);
      vi.mocked(repo.softDelete).mockResolvedValue(true);

      const result = await service.remove(baseProduct.id, ORG_ID, 1);

      expect(result.ok).toBe(true);
    });

    it('returns err(404) when product does not exist', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);

      const result = await service.remove('missing', ORG_ID, 1);

      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(404);
    });

    it('returns err(409) when version mismatch', async () => {
      vi.mocked(repo.findById).mockResolvedValue(baseProduct);
      vi.mocked(repo.softDelete).mockResolvedValue(false);

      const result = await service.remove(baseProduct.id, ORG_ID, 99);

      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(409);
    });
  });
});
