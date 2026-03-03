'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import { EmptyState } from '@/components/shared/empty-state';
import { ErrorAlert } from '@/components/shared/error-alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useEchelons } from '@/hooks/use-echelons';
import { ECHELON_STATE_BADGE_CLASS } from '@/lib/constants/state-badges';

export function DashboardEchelonsList() {
  const tDashboard = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const echelons = useEchelons({ limit: 4 });
  const items = (echelons.data?.data ?? []) as { id: string; name?: string; state?: string }[];

  if (echelons.isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-20" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col divide-y">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex justify-between py-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (echelons.isError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <ErrorAlert
            message={echelons.error?.message ?? tCommon('error')}
            onRetry={() => {
              void echelons.refetch();
            }}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <h3 className="section-title">{tDashboard('activeEchelonsList')}</h3>
        <Button variant="ghost" size="sm" className="text-xs" asChild>
          <Link href="/echelons">{tCommon('seeAll')} →</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState title={tCommon('empty')} description="No hay echelons activos." />
        ) : (
          <div className="flex flex-col divide-y">
            {items.map((e) => (
              <Link
                key={e.id}
                href={`/echelons/${e.id}`}
                className="-mx-2 flex items-center justify-between rounded px-2 py-2 text-sm font-medium hover:bg-muted/50"
              >
                <span className="min-w-0 truncate pr-2">{e.name ?? e.id}</span>
                {e.state != null && (
                  <Badge variant="outline" className={ECHELON_STATE_BADGE_CLASS[e.state] ?? ''}>
                    {e.state.replace('_', ' ')}
                  </Badge>
                )}
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
