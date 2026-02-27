'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

type SummaryResponse = Record<string, unknown>;

const summaryKeys = {
  all: ['summaries'] as const,
  bySession: (sessionId: string) => [...summaryKeys.all, 'session', sessionId] as const,
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export function useSummaryBySession(sessionId: string | null) {
  return useQuery({
    queryKey: summaryKeys.bySession(sessionId ?? ''),
    queryFn: async () => {
      const res = await fetchJson<{ data: SummaryResponse }>(
        `/api/v1/sessions/${String(sessionId)}/summary`,
      );
      return res.data;
    },
    staleTime: 5_000,
    enabled: sessionId != null && sessionId.length > 0,
  });
}

export function useUpdateSummary(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { rawContent?: string; editedContent?: string; version: number }) =>
      fetchJson<SummaryResponse>(`/api/v1/sessions/${sessionId}/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: summaryKeys.bySession(sessionId) });
    },
  });
}
