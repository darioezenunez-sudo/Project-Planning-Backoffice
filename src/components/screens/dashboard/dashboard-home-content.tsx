'use client';

import { useTranslations } from 'next-intl';
import * as React from 'react';

import { DashboardActivity } from '@/components/screens/dashboard/dashboard-activity';
import { DashboardChart } from '@/components/screens/dashboard/dashboard-chart';
import { DashboardEchelonsList } from '@/components/screens/dashboard/dashboard-echelons-list';
import { DashboardStats } from '@/components/screens/dashboard/dashboard-stats';

export function DashboardHomeContent() {
  const t = useTranslations('dashboard');

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
      <DashboardStats />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DashboardChart />
        </div>
        <div>
          <DashboardEchelonsList />
        </div>
      </div>
      <DashboardActivity />
    </div>
  );
}
