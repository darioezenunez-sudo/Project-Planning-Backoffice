'use client';

import { useQuery } from '@tanstack/react-query';

import type { ListEchelonsQuery } from '@/schemas/echelon.schema';
import type { PaginationMeta } from '@/schemas/shared.schema';

type EchelonResponse = Record<string, unknown>;
type EchelonsListResponse = { data: EchelonResponse[]; meta: PaginationMeta };

const echelonKeys = {
  all: ['echelons'] as const,
  lists: () => [...echelonKeys.all, 'list'] as const,
  list: (params: ListEchelonsQuery) => [...echelonKeys.lists(), params] as const,
  details: () => [...echelonKeys.all, 'detail'] as const,
  detail: (id: string) => [...echelonKeys.details(), id] as const,
  sessions: (id: string) => [...echelonKeys.detail(id), 'sessions'] as const,
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

const defaultListParams: ListEchelonsQuery = { limit: 20 };

export function useEchelons(params?: ListEchelonsQuery) {
  const resolved = params ?? defaultListParams;
  const search = `?${new URLSearchParams(
    Object.fromEntries(Object.entries(resolved).map(([k, v]) => [k, String(v)])),
  )}`;
  return useQuery({
    queryKey: echelonKeys.list(resolved),
    queryFn: () => fetchJson<EchelonsListResponse>(`/api/v1/echelons${search}`),
    staleTime: 30_000,
  });
}

export function useEchelon(id: string | null) {
  return useQuery({
    queryKey: echelonKeys.detail(id ?? ''),
    queryFn: async () => {
      const res = await fetchJson<{ data: EchelonResponse }>(`/api/v1/echelons/${String(id)}`);
      return res.data;
    },
    staleTime: 5_000,
    enabled: id != null && id.length > 0,
  });
}

export function useEchelonSessions(echelonId: string | null) {
  return useQuery({
    queryKey: echelonKeys.sessions(echelonId ?? ''),
    queryFn: () => fetchJson<{ data: unknown[] }>(`/api/v1/echelons/${String(echelonId)}/sessions`),
    staleTime: 5_000,
    enabled: echelonId != null && echelonId.length > 0,
  });
}
