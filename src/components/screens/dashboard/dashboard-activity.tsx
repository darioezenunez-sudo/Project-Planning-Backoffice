'use client';

import { useTranslations } from 'next-intl';
import * as React from 'react';

import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function DashboardActivity() {
  const t = useTranslations('dashboard');

  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-medium">{t('recentActivity')}</h3>
      </CardHeader>
      <CardContent>
        <EmptyState
          title={t('noActivity')}
          description="Los eventos de auditoría se mostrarán aquí cuando estén disponibles."
        />
      </CardContent>
    </Card>
  );
}
