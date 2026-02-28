'use client';

import { useAuthStore } from '@/stores/auth-store';

/** Returns the active organization name from the auth store. */
export function useOrganization(): { name: string } {
  const name = useAuthStore((s) => s.organizationName);
  return { name: name ?? '' };
}
