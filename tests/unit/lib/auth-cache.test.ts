import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getUserIdFromAuthCache, invalidateAuthCache, setAuthCache } from '@/lib/cache/auth-cache';

const mockKvGet = vi.fn();
const mockKvSet = vi.fn();
const mockKvDel = vi.fn();

vi.mock('@/lib/cache/kv', () => ({
  kvGet: (...args: unknown[]) => mockKvGet(...args) as Promise<unknown>,
  kvSet: (...args: unknown[]) => mockKvSet(...args) as Promise<void>,
  kvDel: (...args: unknown[]) => mockKvDel(...args) as Promise<void>,
}));

describe('auth-cache', () => {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
  const userId = 'user-aaa-bbb-ccc';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserIdFromAuthCache', () => {
    it('returns userId on cache hit', async () => {
      mockKvGet.mockResolvedValue(userId);
      const result = await getUserIdFromAuthCache(token);
      expect(result).toBe(userId);
      expect(mockKvGet).toHaveBeenCalledTimes(1);
      const key = mockKvGet.mock.calls[0]?.[0];
      expect(key).toMatch(/^auth:[a-f0-9]{24}$/);
      expect(key).not.toContain(token);
    });

    it('returns null on cache miss', async () => {
      mockKvGet.mockResolvedValue(null);
      const result = await getUserIdFromAuthCache(token);
      expect(result).toBeNull();
    });
  });

  describe('setAuthCache', () => {
    it('calls kvSet with hash-derived key (not raw token) and TTL 60', async () => {
      mockKvSet.mockResolvedValue(undefined);
      await setAuthCache(token, userId);
      expect(mockKvSet).toHaveBeenCalledTimes(1);
      const [key, value, ttl] = mockKvSet.mock.calls[0] ?? [];
      expect(key).toMatch(/^auth:[a-f0-9]{24}$/);
      expect(key).not.toContain(token);
      expect(value).toBe(userId);
      expect(ttl).toBe(60);
    });

    it('uses same key for same token (deterministic hash)', async () => {
      mockKvSet.mockResolvedValue(undefined);
      await setAuthCache(token, userId);
      const key1 = mockKvSet.mock.calls[0]?.[0];
      mockKvSet.mockClear();
      await setAuthCache(token, 'other-user');
      const key2 = mockKvSet.mock.calls[0]?.[0];
      expect(key1).toBe(key2);
    });
  });

  describe('invalidateAuthCache', () => {
    it('calls kvDel with key derived from token hash', async () => {
      mockKvDel.mockResolvedValue(undefined);
      await invalidateAuthCache(token);
      expect(mockKvDel).toHaveBeenCalledTimes(1);
      const key = mockKvDel.mock.calls[0]?.[0];
      expect(key).toMatch(/^auth:[a-f0-9]{24}$/);
      expect(key).not.toContain(token);
    });
  });
});
