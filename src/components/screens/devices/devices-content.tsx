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
import { useDevices } from '@/hooks/use-devices';

type DeviceRow = {
  id?: string;
  machineId?: string;
  userAgent?: string;
  lastSeenAt?: string | null;
  [key: string]: unknown;
};

export function DevicesContent() {
  const t = useTranslations('devices');
  const tCommon = useTranslations('common');
  const devices = useDevices();
  const items = (devices.data?.data ?? []) as DeviceRow[];

  if (devices.isError) {
    return (
      <ErrorAlert
        message={devices.error?.message ?? tCommon('error')}
        onRetry={() => {
          void devices.refetch();
        }}
      />
    );
  }

  if (devices.isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-0">
            <SkeletonTable rows={5} columns={4} />
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
                  <TableHead>Dispositivo / ID</TableHead>
                  <TableHead>User agent</TableHead>
                  <TableHead>Última actividad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((d, idx) => (
                  <TableRow key={d.id ?? d.machineId ?? `row-${String(idx)}`}>
                    <TableCell className="font-mono text-xs">
                      {d.machineId ?? d.id ?? '—'}
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground">
                      {d.userAgent ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {d.lastSeenAt != null ? new Date(d.lastSeenAt).toLocaleString() : '—'}
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
