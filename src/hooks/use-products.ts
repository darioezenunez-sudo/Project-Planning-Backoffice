'use client';

import { useQuery } from '@tanstack/react-query';

import type { ListProductsQuery, Product } from '@/schemas/product.schema';
import type { PaginationMeta } from '@/schemas/shared.schema';

type ProductsResponse = { data: Product[]; meta: PaginationMeta };

const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (params: ListProductsQuery) => [...productKeys.lists(), params] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,
};

const defaultListParams: ListProductsQuery = { limit: 20 };

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export function useProducts(params?: ListProductsQuery) {
  const resolved = params ?? defaultListParams;
  const search = `?${new URLSearchParams(
    Object.fromEntries(Object.entries(resolved).map(([k, v]) => [k, String(v)])),
  )}`;
  return useQuery({
    queryKey: productKeys.list(resolved),
    queryFn: () => fetchJson<ProductsResponse>(`/api/v1/products${search}`),
    staleTime: 30_000,
  });
}

export function useProduct(id: string | null) {
  return useQuery({
    queryKey: productKeys.detail(id ?? ''),
    queryFn: async () => {
      const res = await fetch(`/api/v1/products/${String(id)}`);
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { data: Product };
      return json.data;
    },
    staleTime: 30_000,
    enabled: id != null && id.length > 0,
  });
}
