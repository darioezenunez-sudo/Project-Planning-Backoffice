'use client';

import { LayoutDashboard } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useRef, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { useAuthStore } from '@/stores/auth-store';

type MeResponse = {
  data?: {
    memberships: Array<{ organizationId: string; role: string; organizationName: string }>;
  };
};

export default function OnboardingPage() {
  const t = useTranslations('onboarding');
  const router = useRouter();
  const setMemberships = useAuthStore((s) => s.setMemberships);
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  const cancelledRef = useRef(false);
  React.useEffect(() => {
    cancelledRef.current = false;
    void (async () => {
      try {
        const res = await fetch('/api/v1/auth/me');
        const json = (await res.json()) as MeResponse;
        const memberships: Array<{
          organizationId: string;
          role: string;
          organizationName: string;
        }> = json.data?.memberships ?? [];
        if (cancelledRef.current) return;
        if (memberships.length > 0) {
          router.replace('/dashboard');
          return;
        }
      } finally {
        if (!cancelledRef.current) setChecking(false);
      }
    })();
    return () => {
      cancelledRef.current = true;
    };
  }, [router]);

  const handleCreateOrg = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    const name = orgName.trim();
    if (name.length < 2) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/onboarding/create-organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const json = (await res.json()) as { error?: string; data?: unknown };
      if (!res.ok) {
        setError(json.error ?? 'Error al crear la organización.');
        return;
      }
      const meRes = await fetch('/api/v1/auth/me');
      const meJson = (await meRes.json()) as MeResponse;
      const memberships = meJson.data?.memberships;
      if (memberships != null && memberships.length > 0) {
        setMemberships(memberships);
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="auth-bg flex min-h-screen flex-col items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4">
          <Spinner className="size-8" />
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-bg flex min-h-screen flex-col items-center justify-center px-4">
      <div className="flex max-w-[420px] flex-1 flex-col items-center gap-6 py-12">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LayoutDashboard className="size-7" />
          </div>
          <h2 className="text-xl font-semibold">Project Planning Backoffice</h2>
          <p className="text-sm text-muted-foreground">Área de administración</p>
        </div>

        <div className="w-full space-y-4">
          <h1 className="text-center text-xl font-semibold">{t('title')}</h1>
          <p className="text-center text-sm text-muted-foreground">{t('description')}</p>

          <Card>
            <CardHeader className="space-y-1">
              <h3 className="font-medium">{t('createOrg')}</h3>
              <p className="text-sm text-muted-foreground">{t('createOrgDescription')}</p>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  void handleCreateOrg(e);
                }}
                className="flex flex-col gap-4"
              >
                {error != null && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="org-name">{t('orgName')}</Label>
                  <Input
                    id="org-name"
                    value={orgName}
                    onChange={(e) => {
                      setOrgName(e.target.value);
                    }}
                    placeholder={t('orgNamePlaceholder')}
                    minLength={2}
                    maxLength={120}
                    disabled={loading}
                  />
                </div>
                <Button type="submit" disabled={loading || orgName.trim().length < 2}>
                  {loading ? (
                    <>
                      <Spinner className="size-4" />
                      {t('creating')}
                    </>
                  ) : (
                    t('createAndContinue')
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-muted">
            <CardHeader className="space-y-1">
              <h3 className="font-medium">{t('joinExisting')}</h3>
              <p className="text-sm text-muted-foreground">{t('joinExistingDescription')}</p>
            </CardHeader>
          </Card>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/dashboard" className="text-primary underline">
            {t('backToDashboard')}
          </Link>
        </p>
      </div>
    </div>
  );
}
