'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useTenant } from './use-tenant';

type SummaryResponse = Record<string, unknown>;

const summaryKeys = {
  all: ['summaries'] as const,
  bySession: (sessionId: string) => [...summaryKeys.all, 'session', sessionId] as const,
};

export function useSummaryBySession(sessionId: string | null) {
  const { organizationId } = useTenant();
  return useQuery({
    queryKey: summaryKeys.bySession(sessionId ?? ''),
    queryFn: async () => {
      const res = await fetch(`/api/v1/sessions/${String(sessionId)}/summary`, {
        headers: { 'X-Organization-Id': organizationId ?? '' },
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { data: SummaryResponse };
      return json.data;
    },
    enabled: !!organizationId && sessionId != null && sessionId.length > 0,
  });
}

export function useUpdateSummary(sessionId: string) {
  const { organizationId } = useTenant();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { rawContent?: string; editedContent?: string; version: number }) => {
      const res = await fetch(`/api/v1/sessions/${sessionId}/summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-Id': organizationId ?? '',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<SummaryResponse>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: summaryKeys.bySession(sessionId) });
    },
  });
}
