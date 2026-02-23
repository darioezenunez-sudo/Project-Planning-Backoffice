import { describe, it, expect } from 'vitest';

import { hasMinimumRole, ROLE_HIERARCHY } from '@/lib/middleware/with-role';

describe('ROLE_HIERARCHY', () => {
  it('VIEWER has the lowest rank', () => {
    expect(ROLE_HIERARCHY.VIEWER).toBe(0);
  });

  it('SUPER_ADMIN has the highest rank', () => {
    expect(ROLE_HIERARCHY.SUPER_ADMIN).toBe(4);
  });

  it('roles are strictly ordered: VIEWER < MEMBER < MANAGER < ADMIN < SUPER_ADMIN', () => {
    expect(ROLE_HIERARCHY.VIEWER).toBeLessThan(ROLE_HIERARCHY.MEMBER);
    expect(ROLE_HIERARCHY.MEMBER).toBeLessThan(ROLE_HIERARCHY.MANAGER);
    expect(ROLE_HIERARCHY.MANAGER).toBeLessThan(ROLE_HIERARCHY.ADMIN);
    expect(ROLE_HIERARCHY.ADMIN).toBeLessThan(ROLE_HIERARCHY.SUPER_ADMIN);
  });
});

describe('hasMinimumRole', () => {
  // Each role passes its own minimum
  it('VIEWER passes VIEWER requirement', () => {
    expect(hasMinimumRole('VIEWER', 'VIEWER')).toBe(true);
  });

  it('MEMBER passes MEMBER requirement', () => {
    expect(hasMinimumRole('MEMBER', 'MEMBER')).toBe(true);
  });

  it('MANAGER passes MANAGER requirement', () => {
    expect(hasMinimumRole('MANAGER', 'MANAGER')).toBe(true);
  });

  it('ADMIN passes ADMIN requirement', () => {
    expect(hasMinimumRole('ADMIN', 'ADMIN')).toBe(true);
  });

  it('SUPER_ADMIN passes SUPER_ADMIN requirement', () => {
    expect(hasMinimumRole('SUPER_ADMIN', 'SUPER_ADMIN')).toBe(true);
  });

  // Higher roles pass lower requirements
  it('SUPER_ADMIN passes ADMIN requirement', () => {
    expect(hasMinimumRole('SUPER_ADMIN', 'ADMIN')).toBe(true);
  });

  it('ADMIN passes MANAGER requirement', () => {
    expect(hasMinimumRole('ADMIN', 'MANAGER')).toBe(true);
  });

  it('MANAGER passes MEMBER requirement', () => {
    expect(hasMinimumRole('MANAGER', 'MEMBER')).toBe(true);
  });

  it('MEMBER passes VIEWER requirement', () => {
    expect(hasMinimumRole('MEMBER', 'VIEWER')).toBe(true);
  });

  // Lower roles fail higher requirements
  it('VIEWER fails MEMBER requirement', () => {
    expect(hasMinimumRole('VIEWER', 'MEMBER')).toBe(false);
  });

  it('MEMBER fails MANAGER requirement', () => {
    expect(hasMinimumRole('MEMBER', 'MANAGER')).toBe(false);
  });

  it('MANAGER fails ADMIN requirement', () => {
    expect(hasMinimumRole('MANAGER', 'ADMIN')).toBe(false);
  });

  it('ADMIN fails SUPER_ADMIN requirement', () => {
    expect(hasMinimumRole('ADMIN', 'SUPER_ADMIN')).toBe(false);
  });

  it('VIEWER fails SUPER_ADMIN requirement', () => {
    expect(hasMinimumRole('VIEWER', 'SUPER_ADMIN')).toBe(false);
  });
});
