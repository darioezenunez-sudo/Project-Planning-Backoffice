'use client';

import { useTranslations } from 'next-intl';
import * as React from 'react';

import { EmptyState } from '@/components/shared/empty-state';
import { ErrorAlert } from '@/components/shared/error-alert';
import { SkeletonTable } from '@/components/shared/skeleton-table';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useBudget } from '@/hooks/use-budget';

type UsageRow = {
  id?: string;
  monthYear?: string;
  tokens?: number;
  [key: string]: unknown;
};

export function BudgetContent() {
  const t = useTranslations('budget');
  const tCommon = useTranslations('common');
  const budget = useBudget();
  const items = (budget.data?.data ?? []) as UsageRow[];

  if (budget.isError) {
    return (
      <ErrorAlert
        message={budget.error?.message ?? tCommon('error')}
        onRetry={() => {
          void budget.refetch();
        }}
      />
    );
  }

  if (budget.isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-0">
            <SkeletonTable rows={5} columns={3} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
      {items.length === 0 ? (
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="py-12">
            <EmptyState title={t('empty')} />
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((r, idx) => (
                  <TableRow key={r.id ?? r.monthYear ?? idx}>
                    <TableCell className="text-sm">{r.monthYear ?? '—'}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {typeof r.tokens === 'number' ? r.tokens.toLocaleString() : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
