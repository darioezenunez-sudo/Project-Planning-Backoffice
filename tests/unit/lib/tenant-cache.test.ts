import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getTenantCacheKey,
  getTenantMemberFromCache,
  invalidateTenantMemberCache,
  setTenantMemberCache,
} from '@/lib/cache/tenant-cache';

const mockKvGet = vi.fn();
const mockKvSet = vi.fn();
const mockKvDel = vi.fn();

vi.mock('@/lib/cache/kv', () => ({
  kvGet: (...args: unknown[]) => mockKvGet(...args) as Promise<unknown>,
  kvSet: (...args: unknown[]) => mockKvSet(...args) as Promise<void>,
  kvDel: (...args: unknown[]) => mockKvDel(...args) as Promise<void>,
}));

describe('tenant-cache', () => {
  const userId = 'user-111';
  const organizationId = 'org-222';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTenantCacheKey', () => {
    it('returns key with tenant prefix and userId:organizationId', () => {
      expect(getTenantCacheKey(userId, organizationId)).toBe('tenant:user-111:org-222');
    });
  });

  describe('getTenantMemberFromCache', () => {
    it('returns role on cache hit', async () => {
      mockKvGet.mockResolvedValue({ role: 'ADMIN' });
      const result = await getTenantMemberFromCache(userId, organizationId);
      expect(result).toEqual({ role: 'ADMIN' });
      expect(mockKvGet).toHaveBeenCalledWith('tenant:user-111:org-222');
    });

    it('returns null on cache miss', async () => {
      mockKvGet.mockResolvedValue(null);
      const result = await getTenantMemberFromCache(userId, organizationId);
      expect(result).toBeNull();
    });

    it('returns null when kvGet fails (graceful fallback)', async () => {
      mockKvGet.mockRejectedValue(new Error('Redis unavailable'));
      const result = await getTenantMemberFromCache(userId, organizationId);
      expect(result).toBeNull();
    });
  });

  describe('setTenantMemberCache', () => {
    it('calls kvSet with correct key, value and TTL 120', async () => {
      mockKvSet.mockResolvedValue(undefined);
      await setTenantMemberCache(userId, organizationId, 'MANAGER');
      expect(mockKvSet).toHaveBeenCalledWith('tenant:user-111:org-222', { role: 'MANAGER' }, 120);
    });
  });

  describe('invalidateTenantMemberCache', () => {
    it('calls kvDel with correct key', async () => {
      mockKvDel.mockResolvedValue(undefined);
      await invalidateTenantMemberCache(userId, organizationId);
      expect(mockKvDel).toHaveBeenCalledWith('tenant:user-111:org-222');
    });
  });
});
