import { describe, it, expect } from 'vitest';
import {
  parsePaginationParams,
  buildPaginatedResponse,
} from '@/lib/utils/pagination';

describe('pagination', () => {
  it('parsePaginationParams returns defaults', () => {
    const p = parsePaginationParams({});
    expect(p.limit).toBe(20);
    expect(p.sortBy).toBe('createdAt');
    expect(p.sortOrder).toBe('desc');
  });

  it('parsePaginationParams caps limit at 100', () => {
    const p = parsePaginationParams({ limit: '200' });
    expect(p.limit).toBe(100);
  });

  it('buildPaginatedResponse sets hasMore and nextCursor when items exceed limit', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const res = buildPaginatedResponse([...items, { id: 'd' }], { limit: 3 });
    expect(res.data).toHaveLength(3);
    expect(res.meta.hasMore).toBe(true);
    expect(res.meta.nextCursor).toBe('c');
  });
});
