import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '@/lib/errors/app-error';

import { createCompanyService } from '@/modules/company/company.service';
import type { CompanyRepository } from '@/modules/company/company.repository';

const makeRepo = (): CompanyRepository => ({
  findById: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
});

const ORG_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const baseCompany = {
  id: '11111111-1111-1111-1111-111111111111',
  organizationId: ORG_ID,
  name: 'Acme Corp',
  description: null,
  industry: null,
  website: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  version: 1,
};

describe('companyService', () => {
  let repo: CompanyRepository;
  let service: ReturnType<typeof createCompanyService>;

  beforeEach(() => {
    repo = makeRepo();
    service = createCompanyService(repo);
  });

  describe('getById', () => {
    it('returns ok with company when found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(baseCompany);

      const result = await service.getById(baseCompany.id, ORG_ID);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.name).toBe('Acme Corp');
    });

    it('returns err(404) when company does not exist', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);

      const result = await service.getById('missing-id', ORG_ID);

      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(404);
    });
  });

  describe('create', () => {
    it('creates and returns the new company', async () => {
      vi.mocked(repo.create).mockResolvedValue(baseCompany);

      const result = await service.create(ORG_ID, { name: 'Acme Corp' });

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.name).toBe('Acme Corp');
      expect(repo.create).toHaveBeenCalledWith(ORG_ID, { name: 'Acme Corp' });
    });
  });

  describe('update', () => {
    it('returns ok with updated company on success', async () => {
      const updated = { ...baseCompany, name: 'New Name', version: 2 };
      vi.mocked(repo.findById).mockResolvedValue(baseCompany);
      vi.mocked(repo.update).mockResolvedValue(updated);

      const result = await service.update(baseCompany.id, ORG_ID, { name: 'New Name', version: 1 });

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.name).toBe('New Name');
    });

    it('returns err(404) when company does not exist', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);

      const result = await service.update('missing', ORG_ID, { name: 'New Name', version: 1 });

      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(404);
    });

    it('returns err(409) when version mismatch', async () => {
      vi.mocked(repo.findById).mockResolvedValue(baseCompany);
      vi.mocked(repo.update).mockResolvedValue(null);

      const result = await service.update(baseCompany.id, ORG_ID, { name: 'New Name', version: 99 });

      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(409);
    });
  });

  describe('remove', () => {
    it('returns ok(undefined) on successful soft-delete', async () => {
      vi.mocked(repo.findById).mockResolvedValue(baseCompany);
      vi.mocked(repo.softDelete).mockResolvedValue(true);

      const result = await service.remove(baseCompany.id, ORG_ID, 1);

      expect(result.ok).toBe(true);
    });

    it('returns err(404) when company does not exist', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);

      const result = await service.remove('missing', ORG_ID, 1);

      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(404);
    });

    it('returns err(409) when version mismatch', async () => {
      vi.mocked(repo.findById).mockResolvedValue(baseCompany);
      vi.mocked(repo.softDelete).mockResolvedValue(false);

      const result = await service.remove(baseCompany.id, ORG_ID, 99);

      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(409);
    });
  });

  describe('list', () => {
    it('returns paginated list', async () => {
      vi.mocked(repo.findMany).mockResolvedValue({
        items: [baseCompany],
        nextCursor: null,
        hasMore: false,
      });

      const result = await service.list(ORG_ID, { limit: 20 });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.items).toHaveLength(1);
        expect(result.value.hasMore).toBe(false);
      }
    });
  });
});
