'use client';

import { useQuery } from '@tanstack/react-query';

type SessionResponse = Record<string, unknown>;

const sessionKeys = {
  all: ['sessions'] as const,
  details: () => [...sessionKeys.all, 'detail'] as const,
  detail: (id: string) => [...sessionKeys.details(), id] as const,
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export function useSession(id: string | null) {
  return useQuery({
    queryKey: sessionKeys.detail(id ?? ''),
    queryFn: async () => {
      const res = await fetchJson<{ data: SessionResponse }>(`/api/v1/sessions/${String(id)}`);
      return res.data;
    },
    staleTime: 5_000,
    enabled: id != null && id.length > 0,
  });
}
