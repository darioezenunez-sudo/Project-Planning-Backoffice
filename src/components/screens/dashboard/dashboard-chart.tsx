'use client';

import { useTranslations } from 'next-intl';
import * as React from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { ErrorAlert } from '@/components/shared/error-alert';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBudget } from '@/hooks/use-budget';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function aggregateByMonth(
  records: { monthYear?: string; tokens?: number }[],
): { mes: string; tokens: number }[] {
  const byMonth: Record<string, number> = {};
  records.forEach((r) => {
    if (r.monthYear == null) return;
    const key = r.monthYear;
    byMonth[key] = (byMonth[key] ?? 0) + (r.tokens ?? 0);
  });
  const sorted = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6);
  return sorted.map(([key, tokens]) => {
    const [, month] = key.split('-');
    const idx = Number.parseInt(month ?? '0', 10) - 1;
    return { mes: MONTHS[idx] ?? key, tokens };
  });
}

export function DashboardChart() {
  const t = useTranslations('dashboard');
  const budget = useBudget();

  if (budget.isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[220px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (budget.isError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <ErrorAlert
            message={budget.error?.message ?? 'Error al cargar datos de uso de tokens'}
            onRetry={() => {
              void budget.refetch();
            }}
          />
        </CardContent>
      </Card>
    );
  }

  let data = aggregateByMonth(budget.data?.data ?? []);
  if (data.length === 0) {
    data = MONTHS.slice(-6).map((mes) => ({ mes, tokens: 0 }));
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-medium">{t('tokenUsage')}</h3>
        <p className="text-xs text-muted-foreground">{t('tokensThousands')}</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
            <YAxis hide />
            <Tooltip
              formatter={(value: number | undefined) => [
                `${(value ?? 0).toLocaleString()} tokens`,
                'Tokens',
              ]}
              contentStyle={{ fontSize: 12 }}
            />
            <Bar dataKey="tokens" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
