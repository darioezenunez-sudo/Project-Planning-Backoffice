'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Building2, CalendarDays, ChevronRight, Clock, Layers, Plus } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { EmptyState } from '@/components/shared/empty-state';
import { ErrorAlert } from '@/components/shared/error-alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useCompany } from '@/hooks/use-companies';
import { useEchelons } from '@/hooks/use-echelons';
import { useProduct } from '@/hooks/use-products';
import type { Product } from '@/schemas/product.schema';

const stateBadgeClass: Record<string, string> = {
  OPEN: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
  IN_PROGRESS: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  CLOSED: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  CLOSING: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  CLOSURE_REVIEW: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
};

type EchelonRow = {
  id: string;
  name?: string;
  state?: string;
  closedAt?: string | null;
  [key: string]: unknown;
};

export function ProductDetailContent({ productId }: { productId: string }) {
  const product = useProduct(productId);
  const company = useCompany(product.data?.companyId ?? null);
  const echelons = useEchelons({ productId, limit: 50 });

  if (product.isError) {
    return (
      <ErrorAlert message={product.error?.message ?? 'Error'} onRetry={() => product.refetch()} />
    );
  }

  if (product.isLoading || product.data == null) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-10 w-40" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  const p = product.data as Product;
  const companyName = (company.data as { name?: string } | undefined)?.name ?? '—';
  const echelonList = (echelons.data?.data ?? []) as EchelonRow[];
  const sessionsCount = 0; // TODO: aggregate from sessions when needed

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{p.name}</h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            <Link
              href={`/companies/${p.companyId}`}
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <Building2 className="size-3.5" />
              {companyName}
            </Link>
            <span>·</span>
            <span>{echelonList.length} echelons</span>
            <span>·</span>
            <span>{sessionsCount} sesiones totales</span>
          </div>
        </div>
        <Button size="sm">
          <Plus className="mr-2 size-3.5" />
          Nuevo echelon
        </Button>
      </div>

      {echelons.isLoading && (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {echelons.isError && (
        <ErrorAlert
          message={echelons.error?.message ?? 'Error al cargar echelons'}
          onRetry={() => {
            void echelons.refetch();
          }}
        />
      )}

      {!echelons.isLoading && !echelons.isError && echelonList.length === 0 && (
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <EmptyState
              icon={<Layers className="size-10 text-muted-foreground/50" />}
              title="Sin echelons"
              description="Creá el primer echelon para este producto."
              action={
                <Button size="sm">
                  <Plus className="mr-2 size-4" />
                  Nuevo echelon
                </Button>
              }
            />
          </CardContent>
        </Card>
      )}

      {!echelons.isLoading && !echelons.isError && echelonList.length > 0 && (
        <div className="flex flex-col gap-4">
          {echelonList.map((e) => {
            const completed = 0;
            const total = 3;
            const progress = Math.round((completed / total) * 100);
            const sessionCount = 0;
            const lastSessionDate = (e as { lastSessionAt?: string | null }).lastSessionAt;
            const state = e.state ?? 'OPEN';

            return (
              <Card
                key={e.id}
                className="rounded-xl border shadow-sm transition-shadow hover:shadow-md"
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-base font-medium">{e.name ?? e.id}</p>
                      <Badge variant="outline" className={`mt-1 ${stateBadgeClass[state] ?? ''}`}>
                        {state.replace('_', ' ')}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/echelons/${e.id}`}>
                        Ver detalle
                        <ChevronRight className="ml-1 size-3.5" />
                      </Link>
                    </Button>
                  </div>
                  <Progress
                    value={progress}
                    className={`mb-1 mt-3 h-2 ${state === 'CLOSED' && progress >= 100 ? '[&>div]:bg-emerald-500' : ''}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    {completed} de {total} campos completados
                  </p>
                  <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="size-3" />
                      {sessionCount} sesiones
                    </span>
                    <span>·</span>
                    {lastSessionDate != null ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" />
                        Última: {format(new Date(lastSessionDate), 'd MMM yyyy', { locale: es })}
                      </span>
                    ) : (
                      <span>Sin sesiones aún</span>
                    )}
                    {state === 'CLOSED' && e.closedAt != null && (
                      <>
                        <span>·</span>
                        <span>
                          Cerrado el {format(new Date(e.closedAt), 'd MMM yyyy', { locale: es })}
                        </span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
