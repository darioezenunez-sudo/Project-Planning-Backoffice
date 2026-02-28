'use client';

import { useQuery } from '@tanstack/react-query';

import { useTenant } from './use-tenant';

type SessionResponse = Record<string, unknown>;

const sessionKeys = {
  all: ['sessions'] as const,
  details: () => [...sessionKeys.all, 'detail'] as const,
  detail: (id: string) => [...sessionKeys.details(), id] as const,
};

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
    staleTime: 5_000,
    enabled: !!organizationId && id != null && id.length > 0,
  });
}
