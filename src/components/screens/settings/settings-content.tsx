'use client';

import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';

import { ErrorAlert } from '@/components/shared/error-alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function SettingsContent() {
  const t = useTranslations('settings');
  const { user, isLoading } = useAuth();
  const [displayName, setDisplayName] = React.useState('');
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [savingPassword, setSavingPassword] = React.useState(false);

  const metadata = user?.user_metadata as { full_name?: string; name?: string } | undefined;

  React.useEffect(() => {
    if (!user) return;
    setDisplayName(metadata?.full_name ?? metadata?.name ?? '');
  }, [user, metadata?.full_name, metadata?.name]);

  const handleSaveProfile = async () => {
    const supabase = createSupabaseBrowserClient();
    setSavingProfile(true);
    const { error } = await supabase.auth.updateUser({
      data: { full_name: displayName.trim() || undefined },
    });
    setSavingProfile(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t('profileSaved'));
  };

  const handleSavePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error(t('passwordMismatch'));
      return;
    }
    if (newPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    const supabase = createSupabaseBrowserClient();
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t('passwordUpdated'));
    setNewPassword('');
    setConfirmPassword('');
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="page-title">{t('title')}</h1>
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
        <h1 className="page-title">{t('title')}</h1>
        <ErrorAlert message="No se pudo cargar la información del usuario" />
      </div>
    );
  }

  const email = user?.email ?? '—';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="page-title">{t('title')}</h1>
      <Card className="rounded-xl border shadow-sm">
        <CardHeader>
          <h2 className="section-title">{t('profile')}</h2>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="text-muted-foreground">{t('email')}</Label>
            <p className="mt-1 text-sm">{email}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="display-name">{t('displayName')}</Label>
            <div className="flex gap-2">
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t('displayNamePlaceholder')}
                className="max-w-xs"
              />
              <Button onClick={handleSaveProfile} disabled={savingProfile}>
                {t('saveProfile')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-xl border shadow-sm">
        <CardHeader>
          <h2 className="section-title">{t('changePassword')}</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">{t('newPassword')}</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="max-w-xs"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">{t('confirmPassword')}</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="max-w-xs"
              autoComplete="new-password"
            />
          </div>
          <Button
            onClick={handleSavePassword}
            disabled={savingPassword || !newPassword || !confirmPassword}
          >
            {t('savePassword')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
