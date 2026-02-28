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
import { useAudit } from '@/hooks/use-audit';

type AuditRow = {
  id?: string;
  action?: string;
  entity?: string;
  entityId?: string;
  actor?: string;
  createdAt?: string;
  [key: string]: unknown;
};

export function AuditContent() {
  const t = useTranslations('audit');
  const tCommon = useTranslations('common');
  const audit = useAudit({ limit: 50 });
  const items = (audit.data?.data ?? []) as AuditRow[];

  if (audit.isError) {
    return (
      <ErrorAlert
        message={audit.error?.message ?? tCommon('error')}
        onRetry={() => {
          void audit.refetch();
        }}
      />
    );
  }

  if (audit.isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-0">
            <SkeletonTable rows={8} columns={5} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
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
                  <TableHead>Fecha</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Usuario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((r) => (
                  <TableRow key={r.id ?? String(r.createdAt)}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {r.createdAt != null ? new Date(r.createdAt).toLocaleString() : '—'}
                    </TableCell>
                    <TableCell className="text-sm">{r.action ?? '—'}</TableCell>
                    <TableCell className="text-sm">{r.entity ?? '—'}</TableCell>
                    <TableCell className="max-w-[120px] truncate font-mono text-xs">
                      {r.entityId ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.actor ?? '—'}
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
