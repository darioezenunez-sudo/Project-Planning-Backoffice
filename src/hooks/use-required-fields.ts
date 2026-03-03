'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CreateRequiredFieldInput, UpdateRequiredFieldInput } from '@/schemas/echelon.schema';

import { useTenant } from './use-tenant';

const requiredFieldsKeys = {
  all: ['required-fields'] as const,
  byEchelon: (echelonId: string) => [...requiredFieldsKeys.all, 'echelon', echelonId] as const,
};

export function useRequiredFields(echelonId: string | null) {
  const { organizationId } = useTenant();
  return useQuery({
    queryKey: requiredFieldsKeys.byEchelon(echelonId ?? ''),
    queryFn: async () => {
      const res = await fetch(`/api/v1/echelons/${String(echelonId)}/required-fields`, {
        headers: { 'X-Organization-Id': organizationId ?? '' },
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { data: unknown[] };
      return json.data;
    },
    enabled: !!organizationId && echelonId != null && echelonId.length > 0,
  });
}

export function useUpdateRequiredField(echelonId: string) {
  const { organizationId } = useTenant();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateRequiredFieldInput & { id: string }) => {
      const res = await fetch(`/api/v1/required-fields/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-Id': organizationId ?? '',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { data: Record<string, unknown> };
      return json.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: requiredFieldsKeys.byEchelon(echelonId) });
    },
  });
}

export function useCreateRequiredField(echelonId: string) {
  const { organizationId } = useTenant();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateRequiredFieldInput) => {
      const res = await fetch(`/api/v1/echelons/${echelonId}/required-fields`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-Id': organizationId ?? '',
        },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { data: Record<string, unknown> };
      return json.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: requiredFieldsKeys.byEchelon(echelonId) });
    },
  });
}

export function useDeleteRequiredField(echelonId: string) {
  const { organizationId } = useTenant();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, version }: { id: string; version: number }) => {
      const res = await fetch(
        `/api/v1/required-fields/${id}?version=${encodeURIComponent(version)}`,
        {
          method: 'DELETE',
          headers: { 'X-Organization-Id': organizationId ?? '' },
        },
      );
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: requiredFieldsKeys.byEchelon(echelonId) });
    },
  });
}
