'use client';

import { useQuery } from '@tanstack/react-query';

const requiredFieldsKeys = {
  all: ['required-fields'] as const,
  byEchelon: (echelonId: string) => [...requiredFieldsKeys.all, 'echelon', echelonId] as const,
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export function useRequiredFields(echelonId: string | null) {
  return useQuery({
    queryKey: requiredFieldsKeys.byEchelon(echelonId ?? ''),
    queryFn: async () => {
      const res = await fetchJson<{ data: unknown[] }>(
        `/api/v1/echelons/${String(echelonId)}/required-fields`,
      );
      return res.data;
    },
    staleTime: 30_000,
    enabled: echelonId != null && echelonId.length > 0,
  });
}
