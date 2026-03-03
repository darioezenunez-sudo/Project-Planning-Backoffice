'use client';

import { useRealtimeInvalidation } from '@/hooks/use-realtime-invalidation';
import { useTenant } from '@/hooks/use-tenant';

/**
 * Mount inside dashboard layout. Subscribes to Supabase Realtime for echelons/sessions
 * and invalidates TanStack Query cache on changes so lists and details stay in sync
 * when multiple users edit the same org.
 */
export function RealtimeProvider(): null {
  const { organizationId } = useTenant();
  useRealtimeInvalidation(organizationId ?? null);
  return null;
}
