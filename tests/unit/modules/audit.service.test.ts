import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('pino', () => ({
  default: () => ({
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  }),
}));

import { logger } from '@/lib/logger';
import { runWithContext } from '@/lib/request-context';
import { createAuditService } from '@/modules/audit/audit.service';

const mockCreate = vi.fn();
const mockFindMany = vi.fn();

const mockRepo = {
  create: mockCreate,
  findMany: mockFindMany,
};

describe('AuditService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('log', () => {
    it('calls repo.create with the provided input merged with the request context', async () => {
      mockCreate.mockResolvedValue(undefined);
      const service = createAuditService(mockRepo);

      await runWithContext(
        { requestId: 'req-abc', userId: 'user-1', organizationId: 'org-1' },
        () =>
          service.log({
            organizationId: 'org-1',
            actorId: 'user-1',
            entityType: 'Company',
            entityId: 'cmp-1',
            action: 'CREATE',
          }),
      );

      expect(mockCreate).toHaveBeenCalledOnce();
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'Company',
          entityId: 'cmp-1',
          action: 'CREATE',
          requestId: 'req-abc',
        }),
      );
    });

    it('catches repo errors and logs them without rethrowing', async () => {
      mockCreate.mockRejectedValue(new Error('DB write failed'));
      const service = createAuditService(mockRepo);

      // Should NOT throw
      await expect(
        service.log({
          organizationId: 'org-1',
          actorId: 'user-1',
          entityType: 'Company',
          entityId: 'cmp-1',
          action: 'UPDATE',
        }),
      ).resolves.toBeUndefined();

      expect(vi.mocked(logger.error)).toHaveBeenCalledOnce();
    });
  });

  describe('logFromContext', () => {
    it('auto-fills organizationId and actorId from the request context', async () => {
      mockCreate.mockResolvedValue(undefined);
      const service = createAuditService(mockRepo);

      await runWithContext(
        { requestId: 'req-xyz', userId: 'ctx-user', organizationId: 'ctx-org' },
        () => service.logFromContext('Echelon', 'ech-1', 'DELETE'),
      );

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'ctx-user',
          organizationId: 'ctx-org',
          entityType: 'Echelon',
          entityId: 'ech-1',
          action: 'DELETE',
        }),
      );
    });

    it('works when called outside of any request context (undefined userId/org)', async () => {
      mockCreate.mockResolvedValue(undefined);
      const service = createAuditService(mockRepo);

      // No runWithContext → getRequestContext() returns undefined
      await expect(service.logFromContext('Session', 'sess-1', 'CREATE')).resolves.toBeUndefined();

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: undefined,
          organizationId: undefined,
          entityType: 'Session',
        }),
      );
    });
  });

  describe('getByEntity', () => {
    it('delegates to repo.findMany and returns the result', async () => {
      const fakeResult = { items: [], nextCursor: null, hasMore: false };
      mockFindMany.mockResolvedValue(fakeResult);
      const service = createAuditService(mockRepo);

      const result = await service.getByEntity({ organizationId: 'org-1', entityType: 'Company' });

      expect(result).toBe(fakeResult);
      expect(mockFindMany).toHaveBeenCalledWith({ organizationId: 'org-1', entityType: 'Company' });
    });
  });
});
