'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, LayoutDashboard, Lock } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
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
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { registerSchema, type RegisterInput } from '@/schemas/user.schema';

export default function RegisterPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get('email') ?? '';
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: emailFromQuery,
      fullName: '',
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    if (emailFromQuery) form.setValue('email', emailFromQuery);
  }, [emailFromQuery, form]);

  const onSubmit = async (data: RegisterInput) => {
    setSubmitError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: { data: { full_name: data.fullName } },
      });
      if (error != null) {
        setSubmitError(error.message);
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
            <h1 className="text-xl font-semibold">Completá tu registro</h1>
            <p className="text-sm text-muted-foreground">
              Tu cuenta fue pre-creada por un administrador. Solo falta que establezcas tu
              contraseña.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
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
                      <FormLabel className="inline-flex items-center gap-2">
                        {t('email')}
                        <span className="text-xs text-muted-foreground">(read-only)</span>
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type="email"
                            readOnly
                            className="cursor-not-allowed bg-muted pr-9"
                            {...field}
                          />
                          <Lock className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre completo *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: María García" {...field} />
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
                      <FormLabel>Contraseña *</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Mínimo 8 caracteres" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar contraseña *</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Repetí tu contraseña" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Spinner className="size-4" />
                      Creando cuenta...
                    </>
                  ) : (
                    'Crear mi cuenta'
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          ¿Problemas con tu invitación?{' '}
          <Link href="#" className="text-primary underline">
            Contactar soporte
          </Link>
        </p>
      </div>
    </div>
  );
}
