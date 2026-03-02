'use client';

import { useQuery } from '@tanstack/react-query';

import type { ListEchelonsQuery } from '@/schemas/echelon.schema';
import type { PaginationMeta } from '@/schemas/shared.schema';

import { useTenant } from './use-tenant';

type EchelonResponse = Record<string, unknown>;
type EchelonsListResponse = { data: EchelonResponse[]; meta: PaginationMeta };

const echelonKeys = {
  all: ['echelons'] as const,
  lists: () => [...echelonKeys.all, 'list'] as const,
  list: (orgId: string, params: ListEchelonsQuery) =>
    [...echelonKeys.lists(), orgId, params] as const,
  details: () => [...echelonKeys.all, 'detail'] as const,
  detail: (id: string) => [...echelonKeys.details(), id] as const,
  sessions: (id: string) => [...echelonKeys.detail(id), 'sessions'] as const,
};

const defaultListParams: ListEchelonsQuery = { limit: 20 };

export function useEchelons(params?: ListEchelonsQuery) {
  const { organizationId } = useTenant();
  const resolved = params ?? defaultListParams;
  const search = `?${new URLSearchParams(
    Object.fromEntries(Object.entries(resolved).map(([k, v]) => [k, String(v)])),
  )}`;
  return useQuery({
    queryKey: echelonKeys.list(organizationId ?? '', resolved),
    queryFn: async () => {
      const res = await fetch(`/api/v1/echelons${search}`, {
        headers: { 'X-Organization-Id': organizationId ?? '' },
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<EchelonsListResponse>;
    },
    staleTime: 30_000,
    enabled: !!organizationId,
  });
}

export function useEchelon(id: string | null) {
  const { organizationId } = useTenant();
  return useQuery({
    queryKey: echelonKeys.detail(id ?? ''),
    queryFn: async () => {
      const res = await fetch(`/api/v1/echelons/${String(id)}`, {
        headers: { 'X-Organization-Id': organizationId ?? '' },
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { data: EchelonResponse };
      return json.data;
    },
    enabled: !!organizationId && id != null && id.length > 0,
  });
}

export function useEchelonSessions(echelonId: string | null) {
  const { organizationId } = useTenant();
  return useQuery({
    queryKey: echelonKeys.sessions(echelonId ?? ''),
    queryFn: async () => {
      const res = await fetch(`/api/v1/echelons/${String(echelonId)}/sessions`, {
        headers: { 'X-Organization-Id': organizationId ?? '' },
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ data: unknown[] }>;
    },
    enabled: !!organizationId && echelonId != null && echelonId.length > 0,
  });
}
