'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  CreateProductInput,
  ListProductsQuery,
  Product,
  UpdateProductInput,
} from '@/schemas/product.schema';
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
    enabled: !!organizationId && id != null && id.length > 0,
  });
}

export function useCreateProduct() {
  const { organizationId } = useTenant();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProductInput) => {
      const res = await fetch('/api/v1/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-Id': organizationId ?? '',
        },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { data: Product };
      return json.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
  });
}

export function useUpdateProduct() {
  const { organizationId } = useTenant();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateProductInput & { id: string }) => {
      const res = await fetch(`/api/v1/products/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-Id': organizationId ?? '',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { data: Product };
      return json.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: productKeys.detail(variables.id) });
      void queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
  });
}

export function useDeleteProduct() {
  const { organizationId } = useTenant();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, version }: { id: string; version: number }) => {
      const res = await fetch(`/api/v1/products/${id}?version=${encodeURIComponent(version)}`, {
        method: 'DELETE',
        headers: { 'X-Organization-Id': organizationId ?? '' },
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: productKeys.detail(variables.id) });
      void queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
  });
}
