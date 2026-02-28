'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bot, CheckCircle } from 'lucide-react';
import * as React from 'react';

import { ErrorAlert } from '@/components/shared/error-alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useEchelon } from '@/hooks/use-echelons';
import { useSession } from '@/hooks/use-sessions';
import { useSummaryBySession, useUpdateSummary } from '@/hooks/use-summaries';

type SummaryData = {
  id?: string;
  rawContent?: string | null;
  editedContent?: string | null;
  state?: string;
  version?: number;
  createdAt?: string;
  [key: string]: unknown;
};

const stateBadgeClass: Record<string, string> = {
  DRAFT: 'bg-zinc-400/10 text-zinc-400 border-zinc-400/20',
  REVIEW: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
  EDITED: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
  VALIDATED: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
};

export function SessionDetailContent({ sessionId }: { sessionId: string }) {
  const session = useSession(sessionId);
  const summary = useSummaryBySession(sessionId);
  const updateSummary = useUpdateSummary(sessionId);
  const echelonId = (session.data as { echelonId?: string } | undefined)?.echelonId;
  const echelon = useEchelon(echelonId ?? null);
  const echelonName = (echelon.data as { name?: string } | undefined)?.name ?? '—';

  const [editContent, setEditContent] = React.useState('');
  const [saved, setSaved] = React.useState(false);

  const summaryData = summary.data as SummaryData | undefined;
  const displayContent = summaryData?.editedContent ?? summaryData?.rawContent ?? '';
  const sessionData = session.data as { sessionNumber?: number; createdAt?: string } | undefined;

  React.useEffect(() => {
    if (displayContent !== '' && editContent === '') setEditContent(displayContent);
  }, [displayContent, editContent]);

  const handleSave = () => {
    const version = summaryData?.version ?? 1;
    updateSummary.mutate(
      { editedContent: editContent, version },
      {
        onSuccess: () => {
          setSaved(true);
        },
      },
    );
  };

  if (session.isError) {
    return (
      <ErrorAlert message={session.error?.message ?? 'Error'} onRetry={() => session.refetch()} />
    );
  }

  if (session.isLoading || session.data == null) {
    return (
      <div className="flex gap-6">
        <Skeleton className="h-64 flex-[0.65]" />
        <Skeleton className="h-64 flex-[0.35]" />
      </div>
    );
  }

  const sessionDate =
    sessionData?.createdAt != null
      ? format(new Date(sessionData.createdAt), "d 'de' MMMM yyyy", { locale: es })
      : '—';
  const sessionNum = sessionData?.sessionNumber ?? sessionId.slice(0, 8);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-6">
      <div className="flex flex-col gap-4 lg:flex-[0.65]">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Summary — Sesión #{sessionNum}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {sessionDate} · {echelonName}
          </p>
        </div>

        <Tabs defaultValue="editar" className="w-full">
          <TabsList>
            <TabsTrigger value="original">Original IA</TabsTrigger>
            <TabsTrigger value="editar">Editar</TabsTrigger>
          </TabsList>

          <TabsContent value="original" className="mt-4">
            <Card className="rounded-xl border dark:bg-zinc-900/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <span className="text-sm font-medium">Generado por IA</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-zinc-400/10 text-xs text-zinc-400">
                    <Bot className="mr-1 size-3" />
                    IA
                  </Badge>
                  {summaryData?.createdAt != null && (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(summaryData.createdAt), 'd MMM yyyy · HH:mm', {
                        locale: es,
                      })}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {summary.isLoading && <Skeleton className="h-32 w-full" />}
                {summary.isError && (
                  <ErrorAlert
                    message={summary.error?.message ?? 'Error al cargar el summary'}
                    onRetry={() => {
                      void summary.refetch();
                    }}
                  />
                )}
                {!summary.isLoading && !summary.isError && (
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed">
                    {summaryData?.rawContent ?? 'Sin contenido generado.'}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="editar" className="mt-4">
            <Card className="rounded-xl border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b pb-3">
                <span className="text-sm font-medium">Editar resumen</span>
                {saved && (
                  <Badge className="bg-emerald-500/10 text-xs text-emerald-500">
                    <CheckCircle className="mr-1 size-3" />
                    Guardado
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="pt-4">
                <Textarea
                  className="min-h-[300px] resize-y text-sm leading-relaxed"
                  value={editContent}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                    setEditContent(e.target.value);
                    setSaved(false);
                  }}
                  placeholder="Escribí o pegá el resumen aquí..."
                />
                <p className="mt-2 text-right text-xs text-muted-foreground">
                  {editContent.length} caracteres
                </p>
                <Button
                  className="mt-4 w-full sm:w-auto"
                  onClick={handleSave}
                  disabled={updateSummary.isPending || editContent === displayContent}
                >
                  {updateSummary.isPending ? 'Guardando...' : 'Guardar cambios'}
                </Button>
                {updateSummary.isError && (
                  <ErrorAlert
                    message={updateSummary.error?.message ?? 'Error al guardar los cambios'}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <div className="flex flex-col gap-4 lg:flex-[0.35]">
        <Card className="rounded-xl border">
          <CardHeader>
            <h3 className="text-sm font-medium">Estado del summary</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            {summaryData?.state != null && (
              <Badge
                variant="outline"
                className={`px-3 py-1 text-sm ${stateBadgeClass[summaryData.state] ?? ''}`}
              >
                {summaryData.state}
              </Badge>
            )}
            <p className="text-xs text-muted-foreground">
              Aprobar o solicitar edición desde aquí cuando el flujo esté implementado.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
