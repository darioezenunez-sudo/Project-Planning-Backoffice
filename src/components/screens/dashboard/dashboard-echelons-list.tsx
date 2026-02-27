'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useEchelons } from '@/hooks/use-echelons';

const stateBadgeClass: Record<string, string> = {
  IN_PROGRESS: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  CLOSING: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  CLOSURE_REVIEW: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  CLOSED: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  OPEN: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
};

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
          <p className="text-sm text-muted-foreground">
            {echelons.error?.message ?? tCommon('error')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <h3 className="text-lg font-medium">{tDashboard('activeEchelonsList')}</h3>
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
                <span>{e.name ?? e.id}</span>
                {e.state != null && (
                  <Badge variant="outline" className={stateBadgeClass[e.state] ?? ''}>
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
