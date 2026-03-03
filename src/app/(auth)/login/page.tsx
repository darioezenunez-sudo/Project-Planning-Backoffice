'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, CheckCircle2, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { loginSchema, type LoginInput } from '@/schemas/user.schema';

export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get('registered') === '1';
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginInput) => {
    setSubmitError(null);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setSubmitError(json.error ?? 'Credenciales incorrectas. Verificá tu correo y contraseña.');
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setSubmitError('Error de conexión. Intentá de nuevo.');
    }
  };

  const isSubmitting = form.formState.isSubmitting;

  return (
    <div className="auth-bg flex min-h-screen flex-col items-center justify-center px-4">
      <div className="flex max-w-[400px] flex-1 flex-col items-center gap-6 py-12">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LayoutDashboard className="size-7" />
          </div>
          <h2 className="text-xl font-semibold">Project Planning Backoffice</h2>
          <p className="text-sm text-muted-foreground">Área de administración</p>
        </div>

        <Card className="w-full rounded-xl border shadow-sm">
          <CardHeader className="space-y-1">
            <h1 className="text-xl font-semibold">{t('login')}</h1>
            <p className="text-sm text-muted-foreground">Ingresá tus credenciales para continuar</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {registered && (
              <Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-200">
                <CheckCircle2 className="size-4" />
                <AlertDescription>{t('checkEmailConfirm')}</AlertDescription>
              </Alert>
            )}
            {submitError != null && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}
            <Form {...form}>
              <form
                onSubmit={(e) => {
                  void form.handleSubmit(onSubmit)(e);
                }}
                className="flex flex-col gap-4"
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('email')}</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="tu@empresa.com"
                          autoComplete="email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>{t('password')}</FormLabel>
                        <Link
                          href="/login/forgot"
                          className="text-sm text-muted-foreground underline"
                        >
                          {t('forgotPassword')}
                        </Link>
                      </div>
                      <FormControl>
                        <Input type="password" autoComplete="current-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Spinner className="size-4" />
                      Ingresando...
                    </>
                  ) : (
                    'Ingresar'
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          {t('noAccount')}{' '}
          <Link href="/register" className="text-primary underline">
            {t('register')}
          </Link>
        </p>
      </div>
    </div>
  );
}
