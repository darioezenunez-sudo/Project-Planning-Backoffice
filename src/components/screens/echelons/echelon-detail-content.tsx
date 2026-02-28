'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarDays, ChevronRight, Clock, MoreHorizontal, Plus, Upload } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { ErrorAlert } from '@/components/shared/error-alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEchelon, useEchelonSessions } from '@/hooks/use-echelons';
import { useRequiredFields } from '@/hooks/use-required-fields';

const stateBadgeClass: Record<string, string> = {
  IN_PROGRESS: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  OPEN: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
  CLOSED: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  VALIDATED: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  DRAFT: 'bg-zinc-400/10 text-zinc-400 border-zinc-400/20',
  REVIEW: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
};

type RequiredFieldRow = {
  id: string;
  label?: string;
  description?: string | null;
  isMet?: boolean;
  metByUserId?: string | null;
  updatedAt?: string;
  [key: string]: unknown;
};

type SessionRow = {
  id: string;
  sessionNumber?: number;
  notes?: string | null;
  createdAt?: string;
  [key: string]: unknown;
};

export function EchelonDetailContent({ echelonId }: { echelonId: string }) {
  const echelon = useEchelon(echelonId);
  const sessions = useEchelonSessions(echelonId);
  const requiredFields = useRequiredFields(echelonId);

  if (echelon.isError) {
    return (
      <ErrorAlert
        message={echelon.error?.message ?? 'Error'}
        onRetry={() => {
          void echelon.refetch();
        }}
      />
    );
  }

  if (echelon.isLoading || echelon.data == null) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const e = echelon.data as Record<string, unknown>;
  const name = (e.name as string) ?? echelonId;
  const state = (e.state as string) ?? 'OPEN';
  const sessionsList = (sessions.data?.data ?? []) as SessionRow[];
  const fieldsList = (requiredFields.data ?? []) as RequiredFieldRow[];
  const completedCount = fieldsList.filter((f) => f.isMet === true).length;
  const totalFields = fieldsList.length;
  const progress = totalFields > 0 ? Math.round((completedCount / totalFields) * 100) : 0;
  const lastSession = sessionsList[0];
  const lastSessionDate = lastSession?.createdAt;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
          <Badge variant="outline" className={`px-3 py-1 text-sm ${stateBadgeClass[state] ?? ''}`}>
            {state.replace('_', ' ')}
          </Badge>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Progress value={progress} className="h-2 w-32 sm:w-48" />
            <span>
              {completedCount}/{totalFields} campos
            </span>
          </div>
          <span className="hidden sm:inline">·</span>
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" />
            {sessionsList.length} sesiones
          </span>
          <span className="hidden sm:inline">·</span>
          {lastSessionDate != null ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" />
              Última: {format(new Date(lastSessionDate), 'd MMM yyyy', { locale: es })}
            </span>
          ) : (
            <span>Sin sesiones aún</span>
          )}
        </div>
      </div>

      <Tabs defaultValue="requerimientos" className="w-full">
        <TabsList className="sticky top-14 z-10 h-auto w-full justify-start overflow-x-auto rounded-none border-b bg-background p-0">
          <TabsTrigger
            value="requerimientos"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Requerimientos
            <Badge variant="secondary" className="ml-2 text-xs">
              {completedCount}/{totalFields}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="sesiones"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Sesiones
            <Badge variant="secondary" className="ml-2 text-xs">
              {sessionsList.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="summaries"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Summaries
            <Badge variant="secondary" className="ml-2 text-xs">
              {sessionsList.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="adjuntos"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Adjuntos
            <Badge variant="secondary" className="ml-2 text-xs">
              0
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requerimientos" className="mt-4">
          <div className="mb-4 flex justify-end">
            <Button size="sm" variant="outline">
              <Plus className="mr-2 size-3.5" />
              Agregar campo
            </Button>
          </div>
          {requiredFields.isLoading && <Skeleton className="h-32 w-full" />}
          {requiredFields.isError && (
            <ErrorAlert
              message={requiredFields.error?.message ?? 'Error al cargar campos requeridos'}
              onRetry={() => {
                void requiredFields.refetch();
              }}
            />
          )}
          {!requiredFields.isLoading && !requiredFields.isError && fieldsList.length === 0 && (
            <p className="text-sm text-muted-foreground">No hay campos requeridos.</p>
          )}
          {!requiredFields.isLoading && !requiredFields.isError && fieldsList.length > 0 && (
            <div className="flex flex-col gap-2">
              {fieldsList.map((f) => (
                <Card key={f.id} className="rounded-lg border p-4 hover:bg-muted/30">
                  <div className="flex items-start gap-3">
                    <Checkbox checked={f.isMet === true} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{f.label ?? f.id}</span>
                        <Badge
                          variant="outline"
                          className={
                            f.isMet === true
                              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500'
                              : 'border-zinc-500/20 bg-zinc-500/10 text-zinc-500'
                          }
                        >
                          {f.isMet === true ? 'Cumplido' : 'Pendiente'}
                        </Badge>
                      </div>
                      {f.description != null && f.description !== '' && (
                        <p className="mt-1 text-xs text-muted-foreground">{f.description}</p>
                      )}
                      {f.isMet === true && f.updatedAt != null && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Marcado · {format(new Date(f.updatedAt), 'd MMM yyyy', { locale: es })}
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Editar</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive">
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sesiones" className="mt-4">
          <div className="mb-4 flex justify-end">
            <Button size="sm" variant="outline">
              Nueva sesión
            </Button>
          </div>
          {sessions.isLoading && <Skeleton className="h-48 w-full" />}
          {sessions.isError && (
            <ErrorAlert
              message={sessions.error?.message ?? 'Error al cargar sesiones'}
              onRetry={() => {
                void sessions.refetch();
              }}
            />
          )}
          {!sessions.isLoading && !sessions.isError && sessionsList.length === 0 && (
            <p className="text-sm text-muted-foreground">No hay sesiones.</p>
          )}
          {!sessions.isLoading && !sessions.isError && sessionsList.length > 0 && (
            <div className="relative ml-4 border-l border-muted">
              {sessionsList.map((sess, idx) => (
                <div key={sess.id} className="relative pb-4 pl-8">
                  <span
                    className="absolute left-0 top-1.5 size-3 -translate-x-[7px] rounded-full border-2 border-background bg-primary"
                    aria-hidden
                  />
                  <Card className="rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">
                        Sesión #{sessionsList.length - idx}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {sess.createdAt != null
                          ? format(new Date(sess.createdAt), 'd MMM yyyy', { locale: es })
                          : '—'}
                      </span>
                    </div>
                    {sess.notes != null && sess.notes !== '' && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {sess.notes}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/sessions/${sess.id}`}>Ver resumen →</Link>
                      </Button>
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="summaries" className="mt-4">
          <p className="text-sm text-muted-foreground">
            Resúmenes por sesión. Ver desde cada sesión.
          </p>
        </TabsContent>

        <TabsContent value="adjuntos" className="mt-4">
          <div className="mb-4 flex justify-end">
            <Button size="sm" variant="outline">
              <Upload className="mr-2 size-3.5" />
              Subir adjunto
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">No hay adjuntos.</p>
        </TabsContent>
      </Tabs>

      {/* Action bar — TODO: botones según estado FSM */}
      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 border-t bg-background/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Estado: <span className="font-medium">{state}</span> — {completedCount}/{totalFields}{' '}
            campos
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            <Button variant="outline" size="sm" className="w-full sm:w-auto">
              Ver consolidación anterior
            </Button>
            <Button size="sm" className="w-full sm:w-auto" asChild>
              <Link href={`/echelons/${echelonId}/consolidation`}>
                Consolidar echelon
                <ChevronRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
