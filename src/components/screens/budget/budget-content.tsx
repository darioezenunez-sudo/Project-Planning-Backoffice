'use client';

import { useTranslations } from 'next-intl';
import * as React from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { EmptyState } from '@/components/shared/empty-state';
import { ErrorAlert } from '@/components/shared/error-alert';
import { SkeletonTable } from '@/components/shared/skeleton-table';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useBudget, useBudgetLastMonths } from '@/hooks/use-budget';
import type { UsageRecordResponse } from '@/schemas/usage.schema';

const CHART_MONTHS = 6;

function alertLevel(ejecutado: number, limit: number | null): 'over100' | 'over80' | null {
  if (limit == null || limit <= 0) return null;
  const pct = (ejecutado / limit) * 100;
  if (pct >= 100) return 'over100';
  if (pct >= 80) return 'over80';
  return null;
}

export function BudgetContent() {
  const t = useTranslations('budget');
  const tCommon = useTranslations('common');
  const chartQuery = useBudgetLastMonths(CHART_MONTHS);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const budgetQuery = useBudget(currentMonth);
  const items = (budgetQuery.data?.data ?? []) as UsageRecordResponse[];

  const isLoading = chartQuery.isLoading || budgetQuery.isLoading;
  const isError = chartQuery.isError || budgetQuery.isError;
  const error = chartQuery.error ?? budgetQuery.error;

  if (isError) {
    return (
      <ErrorAlert
        message={(error as Error)?.message ?? tCommon('error')}
        onRetry={() => {
          void chartQuery.refetch();
          void budgetQuery.refetch();
        }}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card className="rounded-xl border shadow-sm">
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[260px] w-full" />
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-0">
            <SkeletonTable rows={5} columns={3} />
          </CardContent>
        </Card>
      </div>
    );
  }

  const { periods, limit } = chartQuery.data ?? { periods: [], limit: null };
  const currentPeriod = periods.find((p) => p.monthYear === currentMonth);
  const totalCurrent = currentPeriod?.ejecutado ?? 0;
  const level = alertLevel(totalCurrent, limit);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="page-title">{t('title')}</h1>

      {level !== null && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${
            level === 'over100'
              ? 'border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400'
              : 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400'
          }`}
          role="alert"
        >
          <span aria-hidden>{level === 'over100' ? '🔴' : '🟡'}</span>
          <span>
            {level === 'over100' ? t('alertOver100') : t('alertOver80')}
            {limit != null &&
              ` (${totalCurrent.toLocaleString()} / ${limit.toLocaleString()} tokens)`}
          </span>
        </div>
      )}

      <Card className="rounded-xl border shadow-sm">
        <CardHeader>
          <h2 className="section-title">{t('chartTitle')}</h2>
          <p className="text-xs text-muted-foreground">
            {limit != null
              ? `${t('planificado')}: ${limit.toLocaleString()} tokens/mes`
              : t('noLimitConfigured')}
          </p>
        </CardHeader>
        <CardContent>
          {periods.length === 0 ? (
            <div className="flex h-[260px] items-center justify-center text-muted-foreground">
              {t('empty')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={periods} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  formatter={(value: number | undefined) => (value ?? 0).toLocaleString()}
                  labelFormatter={(label, payload) => {
                    const p = payload[0] as { payload?: { monthYear?: string } } | undefined;
                    const monthYear = p?.payload?.monthYear;
                    return typeof monthYear === 'string' ? monthYear : String(label);
                  }}
                  contentStyle={{ fontSize: 12 }}
                />
                {limit != null && (
                  <Bar
                    dataKey="planificado"
                    name={t('planificado')}
                    fill="hsl(var(--muted-foreground) / 0.5)"
                    radius={[4, 4, 0, 0]}
                  />
                )}
                <Bar
                  dataKey="ejecutado"
                  name={t('ejecutado')}
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl border shadow-sm">
        <CardHeader>
          <h2 className="section-title">{t('breakdownByLine')}</h2>
          <p className="text-xs text-muted-foreground">{currentMonth}</p>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="py-12">
              <EmptyState title={t('empty')} />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('line')}</TableHead>
                  <TableHead className="text-right">{t('tokens')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((r, idx) => {
                  const line = r.productId ?? r.echelonId ?? '—';
                  return (
                    <TableRow key={r.id ?? idx}>
                      <TableCell className="font-mono text-sm">
                        {typeof line === 'string' && line !== '—' ? `${line.slice(0, 8)}…` : line}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {typeof r.tokens === 'number' ? r.tokens.toLocaleString() : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
