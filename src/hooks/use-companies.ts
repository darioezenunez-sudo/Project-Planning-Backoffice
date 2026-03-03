'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  Company,
  CreateCompanyInput,
  ListCompaniesQuery,
  UpdateCompanyInput,
} from '@/schemas/company.schema';
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
    enabled: !!organizationId && id != null && id.length > 0,
  });
}

export function useCreateCompany() {
  const { organizationId } = useTenant();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCompanyInput) => {
      const res = await fetch('/api/v1/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-Id': organizationId ?? '',
        },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { data: Company };
      return json.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: companiesKeys.all });
    },
  });
}

export function useUpdateCompany() {
  const { organizationId } = useTenant();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateCompanyInput & { id: string }) => {
      const res = await fetch(`/api/v1/companies/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-Id': organizationId ?? '',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { data: Company };
      return json.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: companiesKeys.detail(variables.id) });
      void queryClient.invalidateQueries({ queryKey: companiesKeys.all });
    },
  });
}

export function useDeleteCompany() {
  const { organizationId } = useTenant();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, version }: { id: string; version: number }) => {
      const res = await fetch(`/api/v1/companies/${id}?version=${encodeURIComponent(version)}`, {
        method: 'DELETE',
        headers: { 'X-Organization-Id': organizationId ?? '' },
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: companiesKeys.detail(variables.id) });
      void queryClient.invalidateQueries({ queryKey: companiesKeys.all });
    },
  });
}
