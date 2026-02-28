'use client';

import { useQuery } from '@tanstack/react-query';

import type { Company, ListCompaniesQuery } from '@/schemas/company.schema';
import type { PaginationMeta } from '@/schemas/shared.schema';

import { useTenant } from './use-tenant';

type CompaniesResponse = { data: Company[]; meta: PaginationMeta };

const companiesKeys = {
  all: ['companies'] as const,
  lists: () => [...companiesKeys.all, 'list'] as const,
  list: (orgId: string, params: ListCompaniesQuery) =>
    [...companiesKeys.lists(), orgId, params] as const,
  details: () => [...companiesKeys.all, 'detail'] as const,
  detail: (id: string) => [...companiesKeys.details(), id] as const,
};

const defaultListParams: ListCompaniesQuery = { limit: 20 };

export function useCompanies(params?: ListCompaniesQuery) {
  const { organizationId } = useTenant();
  const resolved = params ?? defaultListParams;
  const search = `?${new URLSearchParams(
    Object.fromEntries(Object.entries(resolved).map(([k, v]) => [k, String(v)])),
  )}`;
  return useQuery({
    queryKey: companiesKeys.list(organizationId ?? '', resolved),
    queryFn: async () => {
      const res = await fetch(`/api/v1/companies${search}`, {
        headers: { 'X-Organization-Id': organizationId ?? '' },
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<CompaniesResponse>;
    },
    staleTime: 30_000,
    enabled: !!organizationId,
  });
}

export function useCompany(id: string | null) {
  const { organizationId } = useTenant();
  return useQuery({
    queryKey: companiesKeys.detail(id ?? ''),
    queryFn: async () => {
      const res = await fetch(`/api/v1/companies/${String(id)}`, {
        headers: { 'X-Organization-Id': organizationId ?? '' },
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { data: Company };
      return json.data;
    },
    staleTime: 30_000,
    enabled: !!organizationId && id != null && id.length > 0,
  });
}
