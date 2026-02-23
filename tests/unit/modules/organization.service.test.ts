import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '@/lib/errors/app-error';

import { createOrganizationService } from '@/modules/organization/organization.service';
import type { OrganizationRepository } from '@/modules/organization/organization.repository';

const makeRepo = (): OrganizationRepository => ({
  findById: vi.fn(),
  findBySlug: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
});

const baseOrg = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  name: 'Acme Consulting',
  slug: 'acme-consulting',
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
};

describe('organizationService', () => {
  let repo: OrganizationRepository;
  let service: ReturnType<typeof createOrganizationService>;

  beforeEach(() => {
    repo = makeRepo();
    service = createOrganizationService(repo);
  });

  describe('getById', () => {
    it('returns ok with org when found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(baseOrg);

      const result = await service.getById(baseOrg.id);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.slug).toBe('acme-consulting');
    });

    it('returns err(404) when org does not exist', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);

      const result = await service.getById('missing-id');

      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(404);
    });
  });

  describe('create', () => {
    it('creates org when slug is unique', async () => {
      vi.mocked(repo.findBySlug).mockResolvedValue(null);
      vi.mocked(repo.create).mockResolvedValue(baseOrg);

      const result = await service.create({ name: 'Acme Consulting', slug: 'acme-consulting' });

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.id).toBe(baseOrg.id);
    });

    it('returns err(409) when slug already exists', async () => {
      vi.mocked(repo.findBySlug).mockResolvedValue(baseOrg);

      const result = await service.create({ name: 'Acme Consulting', slug: 'acme-consulting' });

      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(409);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('returns ok with updated org on success', async () => {
      const updated = { ...baseOrg, name: 'Acme Global', version: 2 };
      vi.mocked(repo.update).mockResolvedValue(updated);

      const result = await service.update(baseOrg.id, { name: 'Acme Global', version: 1 });

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.name).toBe('Acme Global');
    });

    it('returns err(409) when version mismatch', async () => {
      vi.mocked(repo.update).mockResolvedValue(null);

      const result = await service.update(baseOrg.id, { name: 'Acme Global', version: 99 });

      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(409);
    });
  });

  describe('remove', () => {
    it('returns ok(undefined) on successful soft-delete', async () => {
      vi.mocked(repo.softDelete).mockResolvedValue(true);

      const result = await service.remove(baseOrg.id, 1);

      expect(result.ok).toBe(true);
    });

    it('returns err(409) when version mismatch', async () => {
      vi.mocked(repo.softDelete).mockResolvedValue(false);

      const result = await service.remove(baseOrg.id, 99);

      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(409);
    });
  });
});
