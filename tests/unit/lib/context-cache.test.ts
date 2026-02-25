import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getContextCacheKey, invalidateContextCacheIfValidated } from '@/lib/cache/context-cache';

vi.mock('@/lib/cache/kv', () => ({
  kvDel: vi.fn().mockResolvedValue(undefined),
}));

describe('context-cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getContextCacheKey', () => {
    it('returns key with ctx prefix and echelonId', () => {
      expect(getContextCacheKey('ech-123')).toBe('ctx:ech-123');
    });
  });

  describe('invalidateContextCacheIfValidated', () => {
    it('calls invalidateContextCache when state is VALIDATED', async () => {
      const { kvDel } = await import('@/lib/cache/kv');
      await invalidateContextCacheIfValidated({
        state: 'VALIDATED',
        echelonId: 'ech-456',
      });
      expect(kvDel).toHaveBeenCalledWith('ctx:ech-456');
    });

    it('does not call kvDel when state is not VALIDATED', async () => {
      const { kvDel } = await import('@/lib/cache/kv');
      await invalidateContextCacheIfValidated({
        state: 'REVIEW',
        echelonId: 'ech-789',
      });
      expect(kvDel).not.toHaveBeenCalled();
    });
  });
});
