'use client';

import { useAuthStore } from '@/stores/auth-store';

/**
 * Returns the active organizationId for the current session.
 * Reads from useAuthStore, which is populated by AuthProvider on mount.
 */
export function useTenant() {
  const organizationId = useAuthStore((s) => s.organizationId);
  const role = useAuthStore((s) => s.role);
  const organizationName = useAuthStore((s) => s.organizationName);
  const isInitialized = useAuthStore((s) => s.isInitialized);

  return { organizationId, role, organizationName, isInitialized };
}
