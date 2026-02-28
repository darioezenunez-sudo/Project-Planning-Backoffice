'use client';

import { useQuery } from '@tanstack/react-query';

import type { ListProductsQuery, Product } from '@/schemas/product.schema';
import type { PaginationMeta } from '@/schemas/shared.schema';

import { useTenant } from './use-tenant';

type ProductsResponse = { data: Product[]; meta: PaginationMeta };

const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (orgId: string, params: ListProductsQuery) =>
    [...productKeys.lists(), orgId, params] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,
};

const defaultListParams: ListProductsQuery = { limit: 20 };

export function useProducts(params?: ListProductsQuery) {
  const { organizationId } = useTenant();
  const resolved = params ?? defaultListParams;
  const search = `?${new URLSearchParams(
    Object.fromEntries(Object.entries(resolved).map(([k, v]) => [k, String(v)])),
  )}`;
  return useQuery({
    queryKey: productKeys.list(organizationId ?? '', resolved),
    queryFn: async () => {
      const res = await fetch(`/api/v1/products${search}`, {
        headers: { 'X-Organization-Id': organizationId ?? '' },
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<ProductsResponse>;
    },
    staleTime: 30_000,
    enabled: !!organizationId,
  });
}

export function useProduct(id: string | null) {
  const { organizationId } = useTenant();
  return useQuery({
    queryKey: productKeys.detail(id ?? ''),
    queryFn: async () => {
      const res = await fetch(`/api/v1/products/${String(id)}`, {
        headers: { 'X-Organization-Id': organizationId ?? '' },
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { data: Product };
      return json.data;
    },
    staleTime: 30_000,
    enabled: !!organizationId && id != null && id.length > 0,
  });
}
