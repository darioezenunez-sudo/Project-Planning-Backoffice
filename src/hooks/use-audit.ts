'use client';

import { useQuery } from '@tanstack/react-query';

/** Audit log — endpoint pendiente en Fase 6. Mock hasta entonces. */
type AuditEntry = {
  id: string;
  createdAt: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
};

const auditKeys = {
  all: ['audit'] as const,
  list: (params: Record<string, unknown>) => [...auditKeys.all, 'list', params] as const,
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export function useAudit(params?: { cursor?: string; limit?: number }) {
  const search = params == null ? '' : `?${new URLSearchParams(params as Record<string, string>)}`;
  return useQuery({
    queryKey: auditKeys.list(params ?? {}),
    queryFn: async (): Promise<{ data: AuditEntry[]; meta: { hasMore: boolean } }> => {
      try {
        return await fetchJson<{ data: AuditEntry[]; meta: { hasMore: boolean } }>(
          `/api/v1/audit${search}`,
        );
      } catch {
        return { data: [], meta: { hasMore: false } };
      }
    },
    staleTime: 30_000,
  });
}
