'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { echelonKeys } from '@/hooks/use-echelons';

import { useTenant } from './use-tenant';

/** Query key prefix for summary by session (must match use-summaries for invalidation). */
const summaryBySessionKey = (sessionId: string) => ['summaries', 'session', sessionId] as const;

export type ConsolidateInput = { version: number };

export type ApproveSummaryInput = { version: number };

/**
 * POST /api/v1/echelons/:id/consolidate — transition to CLOSING and run AI consolidation.
 * Requires echelon version (optimistic locking).
 */
export function useConsolidate(echelonId: string) {
  const { organizationId } = useTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ConsolidateInput) => {
      const res = await fetch(`/api/v1/echelons/${echelonId}/consolidate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-Id': organizationId ?? '',
        },
        body: JSON.stringify({ version: input.version }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ data: { echelon: unknown; usage?: unknown } }>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: echelonKeys.detail(echelonId) });
      void queryClient.invalidateQueries({ queryKey: echelonKeys.details() });
      void queryClient.invalidateQueries({ queryKey: echelonKeys.all });
    },
  });
}

/**
 * PATCH /api/v1/sessions/:id/summary — transition summary to VALIDATED (event: VALIDATE).
 * Use when state is REVIEW or EDITED.
 */
export function useApproveSummary(sessionId: string) {
  const { organizationId } = useTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ApproveSummaryInput) => {
      const res = await fetch(`/api/v1/sessions/${sessionId}/summary`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-Id': organizationId ?? '',
        },
        body: JSON.stringify({ event: 'VALIDATE', version: input.version }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ data: unknown }>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: summaryBySessionKey(sessionId) });
    },
  });
}
