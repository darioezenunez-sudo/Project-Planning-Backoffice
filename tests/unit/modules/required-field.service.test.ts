import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@/lib/errors/app-error';
import { ErrorCode } from '@/lib/errors/error-codes';
import type {
  RequiredFieldRepository,
  RequiredFieldRow,
} from '@/modules/echelon/required-field.repository';
import { createRequiredFieldService } from '@/modules/echelon/required-field.service';

// ─── Factories ────────────────────────────────────────────────────────────────

const ORG_ID = 'org-444';
const ECHELON_ID = 'ech-444';
const FIELD_ID = 'rf-444';

function makeField(overrides: Partial<RequiredFieldRow> = {}): RequiredFieldRow {
  return {
    id: FIELD_ID,
    organizationId: ORG_ID,
    echelonId: ECHELON_ID,
    label: 'Field A',
    description: null,
    isMet: false,
    metAt: null,
    metByUserId: null,
    sortOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    version: 1,
    ...overrides,
  };
}

function makeRepo(overrides: Partial<RequiredFieldRepository> = {}): RequiredFieldRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findManyByEchelon: vi.fn().mockResolvedValue([]),
    allMet: vi.fn().mockResolvedValue(true),
    hasAny: vi.fn().mockResolvedValue(true),
    create: vi.fn().mockResolvedValue(makeField()),
    update: vi.fn().mockResolvedValue(makeField()),
    softDelete: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as unknown as RequiredFieldRepository;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createRequiredFieldService', () => {
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(() => {
    repo = makeRepo();
    vi.clearAllMocks();
  });

  describe('listByEchelon', () => {
    it('returns an empty array when no fields exist', async () => {
      const service = createRequiredFieldService(repo);
      const result = await service.listByEchelon(ECHELON_ID, ORG_ID);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toEqual([]);
      expect(repo.findManyByEchelon).toHaveBeenCalledWith(ECHELON_ID, ORG_ID);
    });

    it('returns list of fields', async () => {
      const fields = [makeField({ id: 'rf-1' }), makeField({ id: 'rf-2' })];
      vi.mocked(repo.findManyByEchelon).mockResolvedValue(fields);
      const service = createRequiredFieldService(repo);
      const result = await service.listByEchelon(ECHELON_ID, ORG_ID);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toHaveLength(2);
    });
  });

  describe('getById', () => {
    it('returns 404 when field not found', async () => {
      const service = createRequiredFieldService(repo);
      const result = await service.getById('missing', ORG_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(404);
    });

    it('returns field when found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeField());
      const service = createRequiredFieldService(repo);
      const result = await service.getById(FIELD_ID, ORG_ID);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.id).toBe(FIELD_ID);
    });
  });

  describe('create', () => {
    it('creates a required field and returns it', async () => {
      const service = createRequiredFieldService(repo);
      const input = { label: 'Field A', sortOrder: 1 };
      const result = await service.create(ECHELON_ID, ORG_ID, input);
      expect(result.ok).toBe(true);
      expect(repo.create).toHaveBeenCalledWith(ECHELON_ID, ORG_ID, input);
    });
  });

  describe('update', () => {
    it('returns 404 when field not found', async () => {
      const service = createRequiredFieldService(repo);
      const result = await service.update('missing', ORG_ID, { isMet: true, version: 1 });
      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(404);
    });

    it('returns 409 on version conflict', async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeField({ version: 2 }));
      vi.mocked(repo.update).mockResolvedValue(null);
      const service = createRequiredFieldService(repo);
      const result = await service.update(FIELD_ID, ORG_ID, { isMet: true, version: 1 });
      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).code).toBe(ErrorCode.CONFLICT);
    });

    it('returns updated field on success', async () => {
      const updated = makeField({ isMet: true, version: 2 });
      vi.mocked(repo.findById).mockResolvedValue(makeField());
      vi.mocked(repo.update).mockResolvedValue(updated);
      const service = createRequiredFieldService(repo);
      const result = await service.update(FIELD_ID, ORG_ID, { isMet: true, version: 1 });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.isMet).toBe(true);
    });
  });

  describe('remove', () => {
    it('returns 404 when field not found', async () => {
      const service = createRequiredFieldService(repo);
      const result = await service.remove('missing', ORG_ID, 1);
      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(404);
    });

    it('returns 409 on version conflict during delete', async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeField({ version: 2 }));
      vi.mocked(repo.softDelete).mockResolvedValue(false);
      const service = createRequiredFieldService(repo);
      const result = await service.remove(FIELD_ID, ORG_ID, 1);
      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).code).toBe(ErrorCode.CONFLICT);
    });

    it('soft deletes on success', async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeField());
      const service = createRequiredFieldService(repo);
      const result = await service.remove(FIELD_ID, ORG_ID, 1);
      expect(result.ok).toBe(true);
      expect(repo.softDelete).toHaveBeenCalledWith(FIELD_ID, ORG_ID, 1);
    });
  });
});
