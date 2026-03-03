'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CreateSessionInput } from '@/schemas/session.schema';

import { useTenant } from './use-tenant';

type SessionResponse = Record<string, unknown>;

const sessionKeys = {
  all: ['sessions'] as const,
  details: () => [...sessionKeys.all, 'detail'] as const,
  detail: (id: string) => [...sessionKeys.details(), id] as const,
};

/** Query key prefix for echelon sessions list (used for invalidation from use-echelons). */
const echelonSessionsPrefix = (echelonId: string) =>
  ['echelons', 'detail', echelonId, 'sessions'] as const;

export function useSession(id: string | null) {
  const { organizationId } = useTenant();
  return useQuery({
    queryKey: sessionKeys.detail(id ?? ''),
    queryFn: async () => {
      const res = await fetch(`/api/v1/sessions/${String(id)}`, {
        headers: { 'X-Organization-Id': organizationId ?? '' },
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { data: SessionResponse };
      return json.data;
    },
    enabled: !!organizationId && id != null && id.length > 0,
  });
}

export function useCreateSession(echelonId: string) {
  const { organizationId } = useTenant();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input?: CreateSessionInput) => {
      const res = await fetch(`/api/v1/echelons/${echelonId}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-Id': organizationId ?? '',
        },
        body: JSON.stringify(input ?? {}),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { data: SessionResponse };
      return json.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: echelonSessionsPrefix(echelonId) });
      void queryClient.invalidateQueries({ queryKey: ['echelons'] });
    },
  });
}

export function useDeleteSession(echelonId: string) {
  const { organizationId } = useTenant();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, version }: { sessionId: string; version: number }) => {
      const res = await fetch(
        `/api/v1/sessions/${sessionId}?version=${encodeURIComponent(version)}`,
        {
          method: 'DELETE',
          headers: { 'X-Organization-Id': organizationId ?? '' },
        },
      );
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: echelonSessionsPrefix(echelonId) });
      void queryClient.invalidateQueries({ queryKey: sessionKeys.all });
    },
  });
}
