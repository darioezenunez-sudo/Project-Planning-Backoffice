'use client';

import { useQuery } from '@tanstack/react-query';

import type { UsageRecordResponse } from '@/schemas/usage.schema';

type UsageListResponse = { data: UsageRecordResponse[] };

const budgetKeys = {
  all: ['usage'] as const,
  list: () => [...budgetKeys.all, 'list'] as const,
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export function useBudget() {
  return useQuery({
    queryKey: budgetKeys.list(),
    queryFn: () => fetchJson<UsageListResponse>('/api/v1/usage'),
    staleTime: 60_000,
  });
}
