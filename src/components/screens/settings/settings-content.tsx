'use client';

import { useTranslations } from 'next-intl';
import * as React from 'react';

import { ErrorAlert } from '@/components/shared/error-alert';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';

export function SettingsContent() {
  const t = useTranslations('settings');
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <Card className="rounded-xl border shadow-sm">
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user == null) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <ErrorAlert message="No se pudo cargar la información del usuario" />
      </div>
    );
  }

  const email = user?.email ?? '—';
  const metadata = user?.user_metadata as { full_name?: string; name?: string } | undefined;
  const fullName = metadata?.full_name ?? metadata?.name ?? '—';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
      <Card className="rounded-xl border shadow-sm">
        <CardHeader>
          <h2 className="text-lg font-medium">{t('profile')}</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Correo</label>
            <p className="mt-1 text-sm">{email}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Nombre</label>
            <p className="mt-1 text-sm">{fullName}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
