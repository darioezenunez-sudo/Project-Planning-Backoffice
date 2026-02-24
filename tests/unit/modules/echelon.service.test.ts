import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@/lib/errors/app-error';
import { ErrorCode } from '@/lib/errors/error-codes';
import type { EchelonRepository, EchelonRow } from '@/modules/echelon/echelon.repository';
import { createEchelonService } from '@/modules/echelon/echelon.service';
import type { RequiredFieldRepository } from '@/modules/echelon/required-field.repository';

// ─── Factories ────────────────────────────────────────────────────────────────

const ORG_ID = 'org-111';
const ECHELON_ID = 'ech-111';

function makeEchelon(overrides: Partial<EchelonRow> = {}): EchelonRow {
  return {
    id: ECHELON_ID,
    organizationId: ORG_ID,
    productId: 'prod-111',
    name: 'Sprint 1',
    state: 'OPEN',
    configBlueprint: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    version: 1,
    ...overrides,
  };
}

function makeRepo(overrides: Partial<EchelonRepository> = {}): EchelonRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue({ items: [], nextCursor: null, hasMore: false }),
    create: vi.fn().mockResolvedValue(makeEchelon()),
    update: vi.fn().mockResolvedValue(makeEchelon()),
    updateState: vi.fn().mockResolvedValue(makeEchelon({ state: 'IN_PROGRESS' })),
    softDelete: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function makeRfRepo(overrides: Partial<RequiredFieldRepository> = {}): RequiredFieldRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findManyByEchelon: vi.fn().mockResolvedValue([]),
    allMet: vi.fn().mockResolvedValue(true),
    hasAny: vi.fn().mockResolvedValue(true),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    ...overrides,
  } as unknown as RequiredFieldRepository;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createEchelonService', () => {
  let repo: ReturnType<typeof makeRepo>;
  let rfRepo: ReturnType<typeof makeRfRepo>;

  beforeEach(() => {
    repo = makeRepo();
    rfRepo = makeRfRepo();
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('returns paginated echelons', async () => {
      const service = createEchelonService(repo, rfRepo);
      const result = await service.list(ORG_ID, { limit: 20 });
      expect(result.ok).toBe(true);
      expect(repo.findMany).toHaveBeenCalledWith(ORG_ID, { limit: 20 });
    });
  });

  describe('getById', () => {
    it('returns 404 when echelon not found', async () => {
      const service = createEchelonService(repo, rfRepo);
      const result = await service.getById('missing', ORG_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(404);
    });

    it('returns echelon with readyToClose=true when all fields met', async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeEchelon());
      vi.mocked(rfRepo.hasAny).mockResolvedValue(true);
      vi.mocked(rfRepo.allMet).mockResolvedValue(true);
      const service = createEchelonService(repo, rfRepo);
      const result = await service.getById(ECHELON_ID, ORG_ID);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.readyToClose).toBe(true);
    });

    it('returns readyToClose=false when no required fields exist', async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeEchelon());
      vi.mocked(rfRepo.hasAny).mockResolvedValue(false);
      const service = createEchelonService(repo, rfRepo);
      const result = await service.getById(ECHELON_ID, ORG_ID);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.readyToClose).toBe(false);
    });
  });

  describe('create', () => {
    it('creates an echelon and returns it', async () => {
      const service = createEchelonService(repo, rfRepo);
      const input = { productId: 'prod-111', name: 'Sprint 1' };
      const result = await service.create(ORG_ID, input);
      expect(result.ok).toBe(true);
      expect(repo.create).toHaveBeenCalledWith(ORG_ID, input);
    });
  });

  describe('update', () => {
    it('returns 404 when echelon not found', async () => {
      const service = createEchelonService(repo, rfRepo);
      const result = await service.update('missing', ORG_ID, { name: 'New', version: 1 });
      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(404);
    });

    it('returns 409 on version conflict', async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeEchelon({ version: 2 }));
      vi.mocked(repo.update).mockResolvedValue(null);
      const service = createEchelonService(repo, rfRepo);
      const result = await service.update(ECHELON_ID, ORG_ID, { name: 'New', version: 1 });
      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(409);
    });

    it('returns updated echelon on success', async () => {
      const base = makeEchelon();
      const updated = makeEchelon({ name: 'Updated', version: 2 });
      vi.mocked(repo.findById).mockResolvedValue(base);
      vi.mocked(repo.update).mockResolvedValue(updated);
      const service = createEchelonService(repo, rfRepo);
      const result = await service.update(ECHELON_ID, ORG_ID, { name: 'Updated', version: 1 });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.name).toBe('Updated');
    });
  });

  describe('consolidate', () => {
    it('returns 404 when echelon not found', async () => {
      const service = createEchelonService(repo, rfRepo);
      const result = await service.consolidate('missing', ORG_ID, 1);
      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(404);
    });

    it('returns 422 when state is OPEN (invalid transition)', async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeEchelon({ state: 'OPEN' }));
      const service = createEchelonService(repo, rfRepo);
      const result = await service.consolidate(ECHELON_ID, ORG_ID, 1);
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect((result.error as AppError).code).toBe(ErrorCode.ECHELON_INVALID_TRANSITION);
    });

    it('returns 422 when required fields not all met', async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeEchelon({ state: 'IN_PROGRESS' }));
      vi.mocked(rfRepo.hasAny).mockResolvedValue(true);
      vi.mocked(rfRepo.allMet).mockResolvedValue(false);
      const service = createEchelonService(repo, rfRepo);
      const result = await service.consolidate(ECHELON_ID, ORG_ID, 1);
      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(422);
    });

    it('transitions to CLOSING when valid', async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeEchelon({ state: 'IN_PROGRESS' }));
      vi.mocked(rfRepo.hasAny).mockResolvedValue(true);
      vi.mocked(rfRepo.allMet).mockResolvedValue(true);
      vi.mocked(repo.updateState).mockResolvedValue(makeEchelon({ state: 'CLOSING' }));
      const service = createEchelonService(repo, rfRepo);
      const result = await service.consolidate(ECHELON_ID, ORG_ID, 1);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.state).toBe('CLOSING');
    });
  });

  describe('close', () => {
    it('returns 422 when state is not CLOSURE_REVIEW', async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeEchelon({ state: 'IN_PROGRESS' }));
      const service = createEchelonService(repo, rfRepo);
      const result = await service.close(ECHELON_ID, ORG_ID, 1);
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect((result.error as AppError).code).toBe(ErrorCode.ECHELON_INVALID_TRANSITION);
    });

    it('transitions to CLOSED from CLOSURE_REVIEW', async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeEchelon({ state: 'CLOSURE_REVIEW' }));
      vi.mocked(repo.updateState).mockResolvedValue(makeEchelon({ state: 'CLOSED' }));
      const service = createEchelonService(repo, rfRepo);
      const result = await service.close(ECHELON_ID, ORG_ID, 1);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.state).toBe('CLOSED');
    });
  });
});
