'use client';

import { Activity, CalendarDays, FileText, Monitor } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDevices } from '@/hooks/use-devices';
import { useEchelons } from '@/hooks/use-echelons';

export function DashboardStats() {
  const t = useTranslations('dashboard');
  const echelons = useEchelons({ limit: 100 });
  const devices = useDevices();

  const isLoading = echelons.isLoading || devices.isLoading;
  const activeCount = (echelons.data?.data ?? []).filter(
    (e: { state?: string }) => e.state != null && e.state !== 'CLOSED',
  ).length;
  const devicesCount = (devices.data?.data ?? []).length;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="size-5 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="mb-2 h-8 w-12" />
              <Skeleton className="h-4 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: t('activeEchelons'),
      value: String(activeCount),
      sub: '+0 este mes',
      icon: Activity,
      iconClass: 'text-primary',
    },
    {
      label: t('sessionsThisMonth'),
      value: '0',
      sub: '+0 vs. mes anterior',
      icon: CalendarDays,
      iconClass: 'text-muted-foreground',
    },
    {
      label: t('summariesPending'),
      value: '0',
      sub: t('requireReview'),
      icon: FileText,
      iconClass: 'text-amber-500',
    },
    {
      label: t('devicesOnline'),
      value: String(devicesCount),
      sub: t('onlineNow'),
      icon: Monitor,
      iconClass: 'text-muted-foreground',
      dot: devicesCount > 0,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(({ label, value, sub, icon: Icon, iconClass, dot }) => (
        <Card key={label}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <span className="text-sm font-medium">{label}</span>
            <Icon className={`size-5 ${iconClass}`} />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{value}</p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              {dot != null && dot && (
                <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
              )}
              {sub}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
