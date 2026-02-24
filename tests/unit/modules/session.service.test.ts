import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@/lib/errors/app-error';
import type { EchelonRepository, EchelonRow } from '@/modules/echelon/echelon.repository';
import type { SessionRepository, SessionRow } from '@/modules/session/session.repository';
import { createSessionService } from '@/modules/session/session.service';

// ─── Factories ────────────────────────────────────────────────────────────────

const ORG_ID = 'org-222';
const ECHELON_ID = 'ech-222';
const SESSION_ID = 'ses-222';

function makeEchelon(overrides: Partial<EchelonRow> = {}): EchelonRow {
  return {
    id: ECHELON_ID,
    organizationId: ORG_ID,
    productId: 'prod-222',
    name: 'Sprint 1',
    state: 'OPEN',
    configBlueprint: null,
    consolidatedReport: null,
    consolidatedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    version: 1,
    ...overrides,
  };
}

function makeSession(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: SESSION_ID,
    organizationId: ORG_ID,
    echelonId: ECHELON_ID,
    sessionNumber: 1,
    conductedAt: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    version: 1,
    ...overrides,
  };
}

function makeSessionRepo(overrides: Partial<SessionRepository> = {}): SessionRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findManyByIds: vi.fn().mockResolvedValue([]),
    findManyByEchelon: vi.fn().mockResolvedValue({ items: [], nextCursor: null, hasMore: false }),
    getNextSessionNumber: vi.fn().mockResolvedValue(1),
    create: vi.fn().mockResolvedValue(makeSession()),
    update: vi.fn().mockResolvedValue(makeSession()),
    softDelete: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function makeEchelonRepo(overrides: Partial<EchelonRepository> = {}): EchelonRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateState: vi.fn().mockResolvedValue(makeEchelon({ state: 'IN_PROGRESS' })),
    softDelete: vi.fn(),
    ...overrides,
  } as unknown as EchelonRepository;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createSessionService', () => {
  let sessionRepo: ReturnType<typeof makeSessionRepo>;
  let echelonRepo: ReturnType<typeof makeEchelonRepo>;

  beforeEach(() => {
    sessionRepo = makeSessionRepo();
    echelonRepo = makeEchelonRepo();
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('returns 404 when echelon not found', async () => {
      const service = createSessionService(sessionRepo, echelonRepo);
      const result = await service.create('missing', ORG_ID, {});
      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(404);
    });

    it('returns 422 when echelon is CLOSED', async () => {
      vi.mocked(echelonRepo.findById).mockResolvedValue(makeEchelon({ state: 'CLOSED' }));
      const service = createSessionService(sessionRepo, echelonRepo);
      const result = await service.create(ECHELON_ID, ORG_ID, {});
      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(422);
    });

    it('transitions echelon OPEN → IN_PROGRESS on first session', async () => {
      vi.mocked(echelonRepo.findById).mockResolvedValue(makeEchelon({ state: 'OPEN' }));
      const service = createSessionService(sessionRepo, echelonRepo);
      const result = await service.create(ECHELON_ID, ORG_ID, {});
      expect(result.ok).toBe(true);
      expect(echelonRepo.updateState).toHaveBeenCalledWith(ECHELON_ID, ORG_ID, 'IN_PROGRESS', 1);
    });

    it('does NOT transition echelon when already IN_PROGRESS', async () => {
      vi.mocked(echelonRepo.findById).mockResolvedValue(makeEchelon({ state: 'IN_PROGRESS' }));
      const service = createSessionService(sessionRepo, echelonRepo);
      const result = await service.create(ECHELON_ID, ORG_ID, {});
      expect(result.ok).toBe(true);
      expect(echelonRepo.updateState).not.toHaveBeenCalled();
    });

    it('assigns sequential session numbers', async () => {
      vi.mocked(echelonRepo.findById).mockResolvedValue(makeEchelon({ state: 'IN_PROGRESS' }));
      vi.mocked(sessionRepo.getNextSessionNumber).mockResolvedValue(3);
      const service = createSessionService(sessionRepo, echelonRepo);
      await service.create(ECHELON_ID, ORG_ID, {});
      expect(sessionRepo.create).toHaveBeenCalledWith(ECHELON_ID, ORG_ID, 3, expect.any(Object));
    });
  });

  describe('getById', () => {
    it('returns 404 when session not found', async () => {
      const service = createSessionService(sessionRepo, echelonRepo);
      const result = await service.getById('missing', ORG_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(404);
    });

    it('returns session when found', async () => {
      vi.mocked(sessionRepo.findById).mockResolvedValue(makeSession());
      const service = createSessionService(sessionRepo, echelonRepo);
      const result = await service.getById(SESSION_ID, ORG_ID);
      expect(result.ok).toBe(true);
    });
  });

  describe('update', () => {
    it('returns 409 on version conflict', async () => {
      vi.mocked(sessionRepo.findById).mockResolvedValue(makeSession({ version: 2 }));
      vi.mocked(sessionRepo.update).mockResolvedValue(null);
      const service = createSessionService(sessionRepo, echelonRepo);
      const result = await service.update(SESSION_ID, ORG_ID, { version: 1 });
      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(409);
    });
  });

  describe('remove', () => {
    it('returns 404 when session not found', async () => {
      const service = createSessionService(sessionRepo, echelonRepo);
      const result = await service.remove('missing', ORG_ID, 1);
      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(404);
    });

    it('soft deletes on success', async () => {
      vi.mocked(sessionRepo.findById).mockResolvedValue(makeSession());
      const service = createSessionService(sessionRepo, echelonRepo);
      const result = await service.remove(SESSION_ID, ORG_ID, 1);
      expect(result.ok).toBe(true);
      expect(sessionRepo.softDelete).toHaveBeenCalledWith(SESSION_ID, ORG_ID, 1);
    });
  });
});
