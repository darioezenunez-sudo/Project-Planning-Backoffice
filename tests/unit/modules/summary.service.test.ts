import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@/lib/errors/app-error';
import { ErrorCode } from '@/lib/errors/error-codes';
import type { SessionRow } from '@/modules/session/session.repository';
import type { SummaryRepository, SummaryRow } from '@/modules/summary/summary.repository';
import { createSummaryService } from '@/modules/summary/summary.service';

// ─── Factories ────────────────────────────────────────────────────────────────

const ORG_ID = 'org-333';
const SESSION_ID = 'ses-333';
const ECHELON_ID = 'ech-333';
const SUMMARY_ID = 'sum-333';

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

function makeSummary(overrides: Partial<SummaryRow> = {}): SummaryRow {
  return {
    id: SUMMARY_ID,
    organizationId: ORG_ID,
    sessionId: SESSION_ID,
    echelonId: ECHELON_ID,
    state: 'DRAFT',
    rawContent: null,
    editedContent: null,
    reviewedAt: null,
    editedAt: null,
    validatedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    version: 1,
    ...overrides,
  };
}

function makeSummaryRepo(overrides: Partial<SummaryRepository> = {}): SummaryRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findBySession: vi.fn().mockResolvedValue(null),
    findManyByEchelon: vi.fn().mockResolvedValue({ items: [], nextCursor: null, hasMore: false }),
    create: vi.fn().mockResolvedValue(makeSummary()),
    update: vi.fn().mockResolvedValue(makeSummary()),
    updateState: vi.fn().mockResolvedValue(makeSummary({ state: 'REVIEW' })),
    softDelete: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function makeSessionRepo() {
  return {
    findById: vi.fn().mockResolvedValue(makeSession()),
    findManyByEchelon: vi.fn(),
    getNextSessionNumber: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createSummaryService', () => {
  let summaryRepo: ReturnType<typeof makeSummaryRepo>;
  let sessionRepo: ReturnType<typeof makeSessionRepo>;

  beforeEach(() => {
    summaryRepo = makeSummaryRepo();
    sessionRepo = makeSessionRepo();
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('returns 404 when session not found', async () => {
      vi.mocked(sessionRepo.findById).mockResolvedValue(null);
      const service = createSummaryService(summaryRepo, sessionRepo as never);
      const result = await service.create(SESSION_ID, ORG_ID, {});
      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(404);
    });

    it('returns 409 if summary already exists for session', async () => {
      vi.mocked(summaryRepo.findBySession).mockResolvedValue(makeSummary());
      const service = createSummaryService(summaryRepo, sessionRepo as never);
      const result = await service.create(SESSION_ID, ORG_ID, {});
      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).code).toBe(ErrorCode.CONFLICT);
    });

    it('creates summary with echelonId from session', async () => {
      const service = createSummaryService(summaryRepo, sessionRepo as never);
      const result = await service.create(SESSION_ID, ORG_ID, { rawContent: 'Hello' });
      expect(result.ok).toBe(true);
      expect(summaryRepo.create).toHaveBeenCalledWith(SESSION_ID, ECHELON_ID, ORG_ID, {
        rawContent: 'Hello',
      });
    });
  });

  describe('transition', () => {
    it('returns 404 when summary not found', async () => {
      const service = createSummaryService(summaryRepo, sessionRepo as never);
      const result = await service.transition('missing', ORG_ID, { event: 'SUBMIT', version: 1 });
      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(404);
    });

    it('SUBMIT: DRAFT → REVIEW', async () => {
      vi.mocked(summaryRepo.findById).mockResolvedValue(makeSummary({ state: 'DRAFT' }));
      vi.mocked(summaryRepo.updateState).mockResolvedValue(makeSummary({ state: 'REVIEW' }));
      const service = createSummaryService(summaryRepo, sessionRepo as never);
      const result = await service.transition(SUMMARY_ID, ORG_ID, { event: 'SUBMIT', version: 1 });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.state).toBe('REVIEW');
      expect(summaryRepo.updateState).toHaveBeenCalledWith(
        SUMMARY_ID,
        ORG_ID,
        'REVIEW',
        expect.any(Object),
        1,
      );
    });

    it('VALIDATE: REVIEW → VALIDATED', async () => {
      vi.mocked(summaryRepo.findById).mockResolvedValue(makeSummary({ state: 'REVIEW' }));
      vi.mocked(summaryRepo.updateState).mockResolvedValue(makeSummary({ state: 'VALIDATED' }));
      const service = createSummaryService(summaryRepo, sessionRepo as never);
      const result = await service.transition(SUMMARY_ID, ORG_ID, {
        event: 'VALIDATE',
        version: 1,
      });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.state).toBe('VALIDATED');
    });

    it('returns 422 on invalid transition (VALIDATED + SUBMIT)', async () => {
      vi.mocked(summaryRepo.findById).mockResolvedValue(makeSummary({ state: 'VALIDATED' }));
      const service = createSummaryService(summaryRepo, sessionRepo as never);
      const result = await service.transition(SUMMARY_ID, ORG_ID, { event: 'SUBMIT', version: 1 });
      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).code).toBe(ErrorCode.UNPROCESSABLE_ENTITY);
    });

    it('returns 409 on version conflict', async () => {
      vi.mocked(summaryRepo.findById).mockResolvedValue(
        makeSummary({ state: 'DRAFT', version: 2 }),
      );
      vi.mocked(summaryRepo.updateState).mockResolvedValue(null);
      const service = createSummaryService(summaryRepo, sessionRepo as never);
      const result = await service.transition(SUMMARY_ID, ORG_ID, { event: 'SUBMIT', version: 1 });
      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(409);
    });
  });

  describe('getById', () => {
    it('returns 404 when not found', async () => {
      const service = createSummaryService(summaryRepo, sessionRepo as never);
      const result = await service.getById('missing', ORG_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(404);
    });
  });
});
