'use client';

import { useQuery } from '@tanstack/react-query';

import { useTenant } from './use-tenant';

/** Audit log — endpoint pendiente en Fase 6. Mock hasta entonces. */
type AuditEntry = {
  id: string;
  createdAt: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
};

type AuditListResult = { data: AuditEntry[]; meta: { hasMore: boolean } };

const auditKeys = {
  all: ['audit'] as const,
  list: (orgId: string, params: Record<string, unknown>) =>
    [...auditKeys.all, 'list', orgId, params] as const,
};

const emptyResult: AuditListResult = { data: [], meta: { hasMore: false } };

export function useAudit(params?: { cursor?: string; limit?: number }) {
  const { organizationId } = useTenant();
  const search = params == null ? '' : `?${new URLSearchParams(params as Record<string, string>)}`;
  return useQuery({
    queryKey: auditKeys.list(organizationId ?? '', params ?? {}),
    queryFn: async (): Promise<AuditListResult> => {
      try {
        const res = await fetch(`/api/v1/audit${search}`, {
          headers: { 'X-Organization-Id': organizationId ?? '' },
        });
        if (!res.ok) return emptyResult;
        return await (res.json() as Promise<AuditListResult>);
      } catch {
        return emptyResult;
      }
    },
    enabled: !!organizationId,
  });
}
