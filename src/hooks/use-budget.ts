'use client';

import { useQuery } from '@tanstack/react-query';

import type { UsageRecordResponse } from '@/schemas/usage.schema';

import { useTenant } from './use-tenant';

type UsageListResponse = { data: UsageRecordResponse[] };

const budgetKeys = {
  all: ['usage'] as const,
  list: (orgId: string, monthYear: string) =>
    [...budgetKeys.all, 'list', orgId, monthYear] as const,
};

export function useBudget(monthYear?: string) {
  const { organizationId } = useTenant();
  const month = monthYear ?? new Date().toISOString().slice(0, 7);
  return useQuery({
    queryKey: budgetKeys.list(organizationId ?? '', month),
    queryFn: async () => {
      const res = await fetch(`/api/v1/usage?monthYear=${month}`, {
        headers: { 'X-Organization-Id': organizationId ?? '' },
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<UsageListResponse>;
    },
    staleTime: 60_000,
    enabled: !!organizationId,
  });
}
