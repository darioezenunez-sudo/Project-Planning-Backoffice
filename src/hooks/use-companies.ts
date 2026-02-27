'use client';

import { useQuery } from '@tanstack/react-query';

import type { Company, ListCompaniesQuery } from '@/schemas/company.schema';
import type { PaginationMeta } from '@/schemas/shared.schema';

type CompaniesResponse = { data: Company[]; meta: PaginationMeta };

const companiesKeys = {
  all: ['companies'] as const,
  lists: () => [...companiesKeys.all, 'list'] as const,
  list: (params: ListCompaniesQuery) => [...companiesKeys.lists(), params] as const,
  details: () => [...companiesKeys.all, 'detail'] as const,
  detail: (id: string) => [...companiesKeys.details(), id] as const,
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

const defaultListParams: ListCompaniesQuery = { limit: 20 };

export function useCompanies(params?: ListCompaniesQuery) {
  const resolved = params ?? defaultListParams;
  const search = `?${new URLSearchParams(
    Object.fromEntries(Object.entries(resolved).map(([k, v]) => [k, String(v)])),
  )}`;
  return useQuery({
    queryKey: companiesKeys.list(resolved),
    queryFn: () => fetchJson<CompaniesResponse>(`/api/v1/companies${search}`),
    staleTime: 30_000,
  });
}

export function useCompany(id: string | null) {
  return useQuery({
    queryKey: companiesKeys.detail(id ?? ''),
    queryFn: async () => {
      const res = await fetchJson<{ data: Company }>(`/api/v1/companies/${String(id)}`);
      return res.data;
    },
    staleTime: 30_000,
    enabled: id != null && id.length > 0,
  });
}
