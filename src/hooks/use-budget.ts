'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { RecordUsageInput, UsageRecordResponse } from '@/schemas/usage.schema';

import { useTenant } from './use-tenant';

type UsageListResponse = { data: UsageRecordResponse[] };
type UsageLimitResponse = { data: { limit: number | null } };

export const budgetKeys = {
  all: ['usage'] as const,
  list: (orgId: string, monthYear: string) =>
    [...budgetKeys.all, 'list', orgId, monthYear] as const,
  limit: () => [...budgetKeys.all, 'limit'] as const,
  lastMonths: (orgId: string, count: number) =>
    [...budgetKeys.all, 'lastMonths', orgId, count] as const,
};

/** GET /api/v1/usage?monthYear=YYYY-MM — usage records for the organization (default: current month). */
export function useBudget(monthYear?: string) {
  const { organizationId } = useTenant();
  const month = monthYear ?? new Date().toISOString().slice(0, 7);
  return useQuery({
    queryKey: budgetKeys.list(organizationId ?? '', month),
    queryFn: async () => {
      const res = await fetch(`/api/v1/usage?monthYear=${encodeURIComponent(month)}`, {
        headers: { 'X-Organization-Id': organizationId ?? '' },
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<UsageListResponse>;
    },
    staleTime: 60_000,
    enabled: !!organizationId,
  });
}

/**
 * GET /api/v1/usage/limit — token limit per org/month (for charts). Returns null if not configured.
 */
export function useBudgetLimit() {
  const { organizationId } = useTenant();
  return useQuery({
    queryKey: budgetKeys.limit(),
    queryFn: async () => {
      const res = await fetch('/api/v1/usage/limit', {
        headers: { 'X-Organization-Id': organizationId ?? '' },
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<UsageLimitResponse>;
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });
}

export type BudgetPeriodPoint = {
  monthYear: string;
  label: string;
  ejecutado: number;
  planificado: number | null;
};

/**
 * Fetches usage for the last N months and aggregates by period. For charts: planificado vs ejecutado.
 */
export function useBudgetLastMonths(count: number) {
  const { organizationId } = useTenant();
  const orgId = organizationId ?? '';

  return useQuery({
    queryKey: budgetKeys.lastMonths(orgId, count),
    queryFn: async (): Promise<{ periods: BudgetPeriodPoint[]; limit: number | null }> => {
      const headers = { 'X-Organization-Id': orgId };
      const [limitRes, ...monthResults] = await Promise.all([
        fetch('/api/v1/usage/limit', { headers }).then(async (r) => {
          if (!r.ok) return null;
          const j = (await r.json()) as UsageLimitResponse;
          const l = j.data.limit;
          return l != null && l > 0 ? l : null;
        }),
        ...Array.from({ length: count }, (_, i) => {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          const monthYear = `${d.getFullYear().toString()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          return fetch(`/api/v1/usage?monthYear=${encodeURIComponent(monthYear)}`, {
            headers,
          }).then(async (res) => {
            if (!res.ok) throw new Error(await res.text());
            const json = (await res.json()) as UsageListResponse;
            const tokens = json.data.reduce((acc, r) => acc + r.tokens, 0);
            return { monthYear, tokens };
          });
        }),
      ]);
      const limit = limitRes ?? null;
      const monthLabels = [
        'Ene',
        'Feb',
        'Mar',
        'Abr',
        'May',
        'Jun',
        'Jul',
        'Ago',
        'Sep',
        'Oct',
        'Nov',
        'Dic',
      ];
      const periods = (monthResults as { monthYear: string; tokens: number }[])
        .sort((a, b) => a.monthYear.localeCompare(b.monthYear))
        .map(({ monthYear, tokens }) => {
          const parts = monthYear.split('-');
          const month = parts[1];
          const idx = Number.parseInt(month ?? '0', 10) - 1;
          return {
            monthYear,
            label: monthLabels[idx] ?? monthYear,
            ejecutado: tokens,
            planificado: limit,
          };
        });
      return { periods, limit };
    },
    enabled: !!organizationId,
    staleTime: 60_000,
  });
}

/**
 * POST /api/v1/usage — record LLM usage (idempotent). Invalidates budget list for the same monthYear.
 */
export function useRecordUsage() {
  const { organizationId } = useTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RecordUsageInput) => {
      const res = await fetch('/api/v1/usage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-Id': organizationId ?? '',
        },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ data: UsageRecordResponse }>;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: budgetKeys.list(organizationId ?? '', variables.monthYear),
      });
      void queryClient.invalidateQueries({ queryKey: budgetKeys.all });
    },
  });
}
