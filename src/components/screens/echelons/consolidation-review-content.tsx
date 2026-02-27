'use client';

import { Bot, CheckCircle, ExternalLink } from 'lucide-react';
import * as React from 'react';

import { ErrorAlert } from '@/components/shared/error-alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useEchelon, useEchelonSessions } from '@/hooks/use-echelons';

const stateBadgeClass: Record<string, string> = {
  CLOSURE_REVIEW: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  VALIDATED: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
};

export function ConsolidationReviewContent({ echelonId }: { echelonId: string }) {
  const echelon = useEchelon(echelonId);
  const sessions = useEchelonSessions(echelonId);
  const [draftContent, setDraftContent] = React.useState('');

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
      <div className="mx-auto max-w-5xl space-y-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  const e = echelon.data as Record<string, unknown>;
  const name = (e.name as string) ?? echelonId;
  const state = (e.state as string) ?? 'OPEN';
  const sessionsList = (sessions.data?.data ?? []) as { id: string }[];
  const productName = '—'; // TODO: resolve product name from echelon.productId

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Revisión de Consolidación</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {name} · {productName}
          </p>
        </div>
        <Badge variant="outline" className={`px-3 py-1 text-sm ${stateBadgeClass[state] ?? ''}`}>
          {state.replace('_', ' ')}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="flex h-full flex-col">
          <CardHeader>
            <h2 className="text-lg font-medium">Reporte generado por IA</h2>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="w-fit bg-zinc-400/10 text-xs text-zinc-400">
                <Bot className="mr-1 size-3" />
                IA
              </Badge>
              <span className="text-xs text-muted-foreground">Generado al consolidar</span>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            <p className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {draftContent ||
                'Ejecutá "Consolidar echelon" desde el detalle del echelon para generar el reporte. Luego podrás revisarlo aquí.'}
            </p>
            <Separator className="my-4" />
            <p className="mb-3 text-sm font-medium">Summaries incluidos ({sessionsList.length}):</p>
            <div className="flex flex-col gap-2">
              {sessionsList.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin sesiones.</p>
              ) : (
                sessionsList.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-md bg-muted/30 p-2"
                  >
                    <span className="text-sm">Sesión</span>
                    <a
                      href={`/sessions/${s.id}`}
                      className="inline-flex items-center gap-1 text-xs text-primary"
                    >
                      Ver
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="flex h-full flex-col">
          <CardHeader>
            <h2 className="text-lg font-medium">Revisión y Aprobación</h2>
            <p className="text-sm text-muted-foreground">
              Editá el reporte antes de cerrar el echelon.
            </p>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <Textarea
              className="min-h-[300px] flex-1 resize-y text-sm leading-relaxed"
              value={draftContent}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                setDraftContent(e.target.value);
              }}
              placeholder="Contenido del reporte de consolidación..."
            />
            <p className="text-right text-xs text-muted-foreground">
              {draftContent.length} caracteres
            </p>
            <Separator />
            <div className="flex flex-col gap-3">
              <Button size="lg" className="w-full bg-emerald-600 text-white hover:bg-emerald-700">
                <CheckCircle className="mr-2 size-4" />
                Aprobar y Cerrar Echelon
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Esta acción es irreversible. El echelon pasará a estado CLOSED.
              </p>
              <Button variant="ghost" size="sm" className="w-full">
                Guardar borrador sin cerrar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
