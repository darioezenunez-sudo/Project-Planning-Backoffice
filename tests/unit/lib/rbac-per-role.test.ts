/**
 * RBAC tests — 5 tests per role.
 *
 * Verifies the role enforcement rules that guard every mutation endpoint:
 *   - The role PASSES operations it is authorised for.
 *   - The role FAILS operations it is NOT authorised for.
 *
 * Roles (lowest → highest): VIEWER < MEMBER < MANAGER < ADMIN < SUPER_ADMIN
 * Minimum-role requirements per endpoint group:
 *   Read-only (GET)    → any authenticated member (no withRole guard)
 *   Products write     → MANAGER
 *   Companies write    → ADMIN
 *   Members write      → ADMIN
 *   Organizations write→ SUPER_ADMIN
 */
import { describe, it, expect } from 'vitest';

import { hasMinimumRole } from '@/lib/middleware/with-role';

// ─── VIEWER ──────────────────────────────────────────────────────────────────
describe('VIEWER role', () => {
  it('passes VIEWER requirement (read-only endpoints)', () => {
    expect(hasMinimumRole('VIEWER', 'VIEWER')).toBe(true);
  });

  it('fails MEMBER requirement', () => {
    expect(hasMinimumRole('VIEWER', 'MEMBER')).toBe(false);
  });

  it('fails MANAGER requirement (product writes blocked)', () => {
    expect(hasMinimumRole('VIEWER', 'MANAGER')).toBe(false);
  });

  it('fails ADMIN requirement (company/member writes blocked)', () => {
    expect(hasMinimumRole('VIEWER', 'ADMIN')).toBe(false);
  });

  it('fails SUPER_ADMIN requirement (org writes blocked)', () => {
    expect(hasMinimumRole('VIEWER', 'SUPER_ADMIN')).toBe(false);
  });
});

// ─── MEMBER ───────────────────────────────────────────────────────────────────
describe('MEMBER role', () => {
  it('passes VIEWER requirement', () => {
    expect(hasMinimumRole('MEMBER', 'VIEWER')).toBe(true);
  });

  it('passes MEMBER requirement', () => {
    expect(hasMinimumRole('MEMBER', 'MEMBER')).toBe(true);
  });

  it('fails MANAGER requirement (product writes blocked)', () => {
    expect(hasMinimumRole('MEMBER', 'MANAGER')).toBe(false);
  });

  it('fails ADMIN requirement (company/member writes blocked)', () => {
    expect(hasMinimumRole('MEMBER', 'ADMIN')).toBe(false);
  });

  it('fails SUPER_ADMIN requirement (org writes blocked)', () => {
    expect(hasMinimumRole('MEMBER', 'SUPER_ADMIN')).toBe(false);
  });
});

// ─── MANAGER ──────────────────────────────────────────────────────────────────
describe('MANAGER role', () => {
  it('passes VIEWER requirement', () => {
    expect(hasMinimumRole('MANAGER', 'VIEWER')).toBe(true);
  });

  it('passes MEMBER requirement', () => {
    expect(hasMinimumRole('MANAGER', 'MEMBER')).toBe(true);
  });

  it('passes MANAGER requirement (can write products)', () => {
    expect(hasMinimumRole('MANAGER', 'MANAGER')).toBe(true);
  });

  it('fails ADMIN requirement (company/member writes blocked)', () => {
    expect(hasMinimumRole('MANAGER', 'ADMIN')).toBe(false);
  });

  it('fails SUPER_ADMIN requirement (org writes blocked)', () => {
    expect(hasMinimumRole('MANAGER', 'SUPER_ADMIN')).toBe(false);
  });
});

// ─── ADMIN ────────────────────────────────────────────────────────────────────
describe('ADMIN role', () => {
  it('passes VIEWER requirement', () => {
    expect(hasMinimumRole('ADMIN', 'VIEWER')).toBe(true);
  });

  it('passes MEMBER requirement', () => {
    expect(hasMinimumRole('ADMIN', 'MEMBER')).toBe(true);
  });

  it('passes MANAGER requirement (can write products)', () => {
    expect(hasMinimumRole('ADMIN', 'MANAGER')).toBe(true);
  });

  it('passes ADMIN requirement (can write companies and manage members)', () => {
    expect(hasMinimumRole('ADMIN', 'ADMIN')).toBe(true);
  });

  it('fails SUPER_ADMIN requirement (org writes blocked)', () => {
    expect(hasMinimumRole('ADMIN', 'SUPER_ADMIN')).toBe(false);
  });
});

// ─── SUPER_ADMIN ──────────────────────────────────────────────────────────────
describe('SUPER_ADMIN role', () => {
  it('passes VIEWER requirement', () => {
    expect(hasMinimumRole('SUPER_ADMIN', 'VIEWER')).toBe(true);
  });

  it('passes MEMBER requirement', () => {
    expect(hasMinimumRole('SUPER_ADMIN', 'MEMBER')).toBe(true);
  });

  it('passes MANAGER requirement (can write products)', () => {
    expect(hasMinimumRole('SUPER_ADMIN', 'MANAGER')).toBe(true);
  });

  it('passes ADMIN requirement (can write companies and manage members)', () => {
    expect(hasMinimumRole('SUPER_ADMIN', 'ADMIN')).toBe(true);
  });

  it('passes SUPER_ADMIN requirement (can manage organizations)', () => {
    expect(hasMinimumRole('SUPER_ADMIN', 'SUPER_ADMIN')).toBe(true);
  });
});
