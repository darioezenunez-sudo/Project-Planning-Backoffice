import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AppError } from '@/lib/errors/app-error';
import { createIdempotencyService } from '@/modules/idempotency/idempotency.service';
import type { IdempotencyRecord, IdempotencyRepository } from '@/modules/idempotency/idempotency.repository';

const makeRepo = (): IdempotencyRepository => ({
  findByKey: vi.fn(),
  createProcessing: vi.fn(),
  markCompleted: vi.fn(),
  markFailed: vi.fn(),
  deleteExpired: vi.fn(),
});

const KEY = 'test-idempotency-key';
const ROUTE = 'POST /test';

const makeRecord = (overrides: Partial<IdempotencyRecord> = {}): IdempotencyRecord => ({
  id: 'rrrrrrrr-rrrr-rrrr-rrrr-rrrrrrrrrrrr',
  key: KEY,
  route: ROUTE,
  status: 'PROCESSING',
  responseStatus: null,
  responseBody: null,
  createdAt: new Date(),
  expiresAt: new Date(),
  ...overrides,
});

describe('idempotencyService', () => {
  let repo: IdempotencyRepository;
  let service: ReturnType<typeof createIdempotencyService>;

  beforeEach(() => {
    repo = makeRepo();
    service = createIdempotencyService(repo);
  });

  describe('check', () => {
    it('returns status=new and claims key when no existing record', async () => {
      vi.mocked(repo.findByKey).mockResolvedValue(null);
      vi.mocked(repo.createProcessing).mockResolvedValue(makeRecord());

      const result = await service.check(KEY, ROUTE);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.status).toBe('new');
      expect(repo.createProcessing).toHaveBeenCalledWith(KEY, ROUTE);
    });

    it('returns err(409) when status is PROCESSING', async () => {
      vi.mocked(repo.findByKey).mockResolvedValue(makeRecord({ status: 'PROCESSING' }));

      const result = await service.check(KEY, ROUTE);

      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(409);
    });

    it('returns status=completed with stored response when COMPLETED', async () => {
      vi.mocked(repo.findByKey).mockResolvedValue(
        makeRecord({ status: 'COMPLETED', responseStatus: 201, responseBody: { id: 'abc' } }),
      );

      const result = await service.check(KEY, ROUTE);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('completed');
        if (result.value.status === 'completed') {
          expect(result.value.responseStatus).toBe(201);
          expect(result.value.responseBody).toEqual({ id: 'abc' });
        }
      }
    });

    it('re-claims key (status=new) when previous request FAILED', async () => {
      vi.mocked(repo.findByKey).mockResolvedValue(makeRecord({ status: 'FAILED' }));
      vi.mocked(repo.createProcessing).mockResolvedValue(makeRecord());

      const result = await service.check(KEY, ROUTE);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.status).toBe('new');
      expect(repo.createProcessing).toHaveBeenCalledWith(KEY, ROUTE);
    });
  });

  describe('complete', () => {
    it('calls markCompleted with key and response data', async () => {
      vi.mocked(repo.markCompleted).mockResolvedValue(undefined);

      await service.complete(KEY, 200, { success: true });

      expect(repo.markCompleted).toHaveBeenCalledWith(KEY, 200, { success: true });
    });
  });

  describe('fail', () => {
    it('calls markFailed with key', async () => {
      vi.mocked(repo.markFailed).mockResolvedValue(undefined);

      await service.fail(KEY);

      expect(repo.markFailed).toHaveBeenCalledWith(KEY);
    });
  });

  describe('cleanup', () => {
    it('returns count of deleted expired records', async () => {
      vi.mocked(repo.deleteExpired).mockResolvedValue(5);

      const count = await service.cleanup();

      expect(count).toBe(5);
    });
  });
});
