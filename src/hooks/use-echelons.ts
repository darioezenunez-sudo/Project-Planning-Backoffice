'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  CreateEchelonInput,
  EchelonEvent,
  ListEchelonsQuery,
  UpdateEchelonInput,
} from '@/schemas/echelon.schema';
import type { PaginationMeta } from '@/schemas/shared.schema';

import { useTenant } from './use-tenant';

type EchelonResponse = Record<string, unknown>;
type EchelonsListResponse = { data: EchelonResponse[]; meta: PaginationMeta };

export const echelonKeys = {
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

export function useEchelonTransition(echelonId: string) {
  const { organizationId } = useTenant();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { event: EchelonEvent; version: number }) => {
      const res = await fetch(`/api/v1/echelons/${echelonId}/transition`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-Id': organizationId ?? '',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { data: Record<string, unknown> };
      return json.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: echelonKeys.detail(echelonId) });
      void queryClient.invalidateQueries({ queryKey: echelonKeys.details() });
      void queryClient.invalidateQueries({ queryKey: echelonKeys.all });
    },
  });
}

export function useCreateEchelon(productId: string) {
  const { organizationId } = useTenant();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<CreateEchelonInput, 'productId'>) => {
      const res = await fetch('/api/v1/echelons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-Id': organizationId ?? '',
        },
        body: JSON.stringify({ ...input, productId }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { data: Record<string, unknown> };
      return json.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: echelonKeys.all });
    },
  });
}

export function useUpdateEchelon() {
  const { organizationId } = useTenant();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateEchelonInput & { id: string }) => {
      const res = await fetch(`/api/v1/echelons/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-Id': organizationId ?? '',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { data: Record<string, unknown> };
      return json.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: echelonKeys.detail(variables.id) });
      void queryClient.invalidateQueries({ queryKey: echelonKeys.all });
    },
  });
}

export function useDeleteEchelon() {
  const { organizationId } = useTenant();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, version }: { id: string; version: number }) => {
      const res = await fetch(`/api/v1/echelons/${id}?version=${encodeURIComponent(version)}`, {
        method: 'DELETE',
        headers: { 'X-Organization-Id': organizationId ?? '' },
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: echelonKeys.detail(variables.id) });
      void queryClient.invalidateQueries({ queryKey: echelonKeys.all });
    },
  });
}
