'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import { echelonKeys } from './use-echelons';

const sessionKeys = {
  all: ['sessions'] as const,
  details: () => [...sessionKeys.all, 'detail'] as const,
  detail: (id: string) => [...sessionKeys.details(), id] as const,
};

type RealtimePayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
};

function invalidateEchelonChange(
  queryClient: ReturnType<typeof useQueryClient>,
  payload: RealtimePayload,
): void {
  const id = (payload.new?.id ?? payload.old?.id) as string | undefined;
  if (id) {
    void queryClient.invalidateQueries({ queryKey: echelonKeys.detail(id) });
    void queryClient.invalidateQueries({ queryKey: echelonKeys.sessions(id) });
  }
  void queryClient.invalidateQueries({ queryKey: echelonKeys.all });
}

function invalidateSessionChange(
  queryClient: ReturnType<typeof useQueryClient>,
  payload: RealtimePayload,
): void {
  const id = (payload.new?.id ?? payload.old?.id) as string | undefined;
  const echelonId = (payload.new?.echelon_id ?? payload.old?.echelon_id) as string | undefined;
  if (id) void queryClient.invalidateQueries({ queryKey: sessionKeys.detail(id) });
  if (echelonId) {
    void queryClient.invalidateQueries({ queryKey: echelonKeys.sessions(echelonId) });
    void queryClient.invalidateQueries({ queryKey: echelonKeys.detail(echelonId) });
  }
  void queryClient.invalidateQueries({ queryKey: sessionKeys.all });
  void queryClient.invalidateQueries({ queryKey: echelonKeys.all });
}

/**
 * Subscribes to Supabase Realtime postgres_changes for echelons and sessions
 * and invalidates TanStack Query cache so the UI refetches fresh data.
 * Requires Supabase Dashboard: Database → Replication → supabase_realtime
 * to include tables `echelons` and `sessions`.
 */
export function useRealtimeInvalidation(organizationId: string | null): void {
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<
    ReturnType<typeof createSupabaseBrowserClient>['channel']
  > | null>(null);

  useEffect(() => {
    if (!organizationId) return;

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`realtime-invalidation-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'echelons',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload: RealtimePayload) => {
          invalidateEchelonChange(queryClient, payload);
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sessions',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload: RealtimePayload) => {
          invalidateSessionChange(queryClient, payload);
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [organizationId, queryClient]);
}
