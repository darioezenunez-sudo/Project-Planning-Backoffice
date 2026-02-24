import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JobRepository, JobRow } from '@/modules/job/job.repository';
import { createJobService } from '@/modules/job/job.service';

function makeJob(overrides: Partial<JobRow> = {}): JobRow {
  return {
    id: 'job-111',
    type: 'PDF',
    status: 'PENDING',
    payload: { echelonId: 'ech-1' },
    attempts: 0,
    maxAttempts: 3,
    scheduledAt: new Date(),
    runAt: null,
    completedAt: null,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeRepo(overrides: Partial<JobRepository> = {}): JobRepository {
  return {
    create: vi.fn().mockResolvedValue(makeJob()),
    findById: vi.fn().mockResolvedValue(null),
    updateStatus: vi.fn().mockResolvedValue(makeJob()),
    incrementAttemptsAndSetError: vi.fn().mockResolvedValue(makeJob()),
    listReadyToRun: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('createJobService', () => {
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(() => {
    repo = makeRepo();
    vi.clearAllMocks();
  });

  describe('enqueue', () => {
    it('creates job with type and payload', async () => {
      const created = makeJob({ type: 'EMAIL', payload: { to: 'a@b.com' } });
      vi.mocked(repo.create).mockResolvedValue(created);

      const service = createJobService(repo);
      const result = await service.enqueue('EMAIL', { to: 'a@b.com' });

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.type).toBe('EMAIL');
      expect(repo.create).toHaveBeenCalledWith('EMAIL', { to: 'a@b.com' }, undefined);
    });
  });

  describe('markFailed', () => {
    it('increments attempts and sets scheduledAt for retry when under maxAttempts', async () => {
      const job = makeJob({ attempts: 0, maxAttempts: 3 });
      vi.mocked(repo.findById).mockResolvedValue(job);
      const failed = makeJob({
        ...job,
        attempts: 1,
        status: 'FAILED',
        errorMessage: 'Network error',
      });
      vi.mocked(repo.incrementAttemptsAndSetError).mockResolvedValue(failed);

      const service = createJobService(repo);
      const result = await service.markFailed('job-111', 'Network error');

      expect(result.ok).toBe(true);
      expect(repo.incrementAttemptsAndSetError).toHaveBeenCalledWith(
        'job-111',
        'Network error',
        expect.objectContaining({ scheduledAt: expect.any(Date) }),
      );
    });

    it('moves to DEAD_LETTER when attempts reach maxAttempts', async () => {
      const job = makeJob({ attempts: 2, maxAttempts: 3 });
      vi.mocked(repo.findById).mockResolvedValue(job);
      const dead = makeJob({
        ...job,
        attempts: 3,
        status: 'DEAD_LETTER',
        errorMessage: 'Final failure',
      });
      vi.mocked(repo.incrementAttemptsAndSetError).mockResolvedValue(dead);

      const service = createJobService(repo);
      const result = await service.markFailed('job-111', 'Final failure');

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.status).toBe('DEAD_LETTER');
    });
  });

  describe('getNextRetryDelayMs', () => {
    it('returns exponential backoff delay', () => {
      const service = createJobService(repo);
      expect(service.getNextRetryDelayMs(0)).toBe(1000);
      expect(service.getNextRetryDelayMs(1)).toBe(2000);
      expect(service.getNextRetryDelayMs(2)).toBe(4000);
    });
  });

  describe('listReadyToRun', () => {
    it('filters out jobs with attempts >= maxAttempts', async () => {
      const jobs = [
        makeJob({ id: 'a', attempts: 0, maxAttempts: 3 }),
        makeJob({ id: 'b', attempts: 3, maxAttempts: 3 }),
      ];
      vi.mocked(repo.listReadyToRun).mockResolvedValue(jobs);

      const service = createJobService(repo);
      const result = await service.listReadyToRun(10);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        const first = result.value[0];
        expect(first).toBeDefined();
        expect(first?.id).toBe('a');
      }
    });
  });
});
