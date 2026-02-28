'use client';

import { useQuery } from '@tanstack/react-query';

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
