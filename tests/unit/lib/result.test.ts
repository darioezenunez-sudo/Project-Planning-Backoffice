import { describe, it, expect } from 'vitest';
import { ok, err, isOk, isErr } from '@/lib/result';

describe('Result pattern', () => {
  it('ok() returns success result', () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    expect(isOk(r)).toBe(true);
    expect(isErr(r)).toBe(false);
    if (isOk(r)) expect(r.value).toBe(42);
  });

  it('err() returns failure result', () => {
    const e = new Error('fail');
    const r = err(e);
    expect(r.ok).toBe(false);
    expect(isErr(r)).toBe(true);
    expect(isOk(r)).toBe(false);
    if (isErr(r)) expect(r.error).toBe(e);
  });
});
