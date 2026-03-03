'use client';

import { Bot, CheckCircle, ExternalLink, GitCompare, XCircle } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';

import { ErrorAlert } from '@/components/shared/error-alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useEchelon,
  useEchelonSessions,
  useEchelonTransition,
  useUpdateEchelon,
} from '@/hooks/use-echelons';
import { useProduct } from '@/hooks/use-products';
import type { ConsolidationOutput } from '@/lib/ai/consolidation.schema';
import { ECHELON_STATE_BADGE_CLASS } from '@/lib/constants/state-badges';

function formatReport(report: ConsolidationOutput | null): {
  executiveSummary: string;
  decisions: Array<{ title: string; description: string; rationale?: string }>;
  checklist: Array<{ label: string; description?: string; met: boolean; notes?: string }>;
  risksAndMitigations: Array<{ risk: string; mitigation?: string }>;
} {
  if (!report || typeof report !== 'object') {
    return {
      executiveSummary: '',
      decisions: [],
      checklist: [],
      risksAndMitigations: [],
    };
  }
  return {
    executiveSummary:
      typeof (report as ConsolidationOutput).executiveSummary === 'string'
        ? (report as ConsolidationOutput).executiveSummary
        : '',
    decisions: Array.isArray((report as ConsolidationOutput).decisions)
      ? (report as ConsolidationOutput).decisions
      : [],
    checklist: Array.isArray((report as ConsolidationOutput).checklist)
      ? (report as ConsolidationOutput).checklist
      : [],
    risksAndMitigations: (report as ConsolidationOutput).risksAndMitigations ?? [],
  };
}

/** Strip HTML tags to plain text for diff (SSR-safe). */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type DiffPart = { type: 'removed' | 'added' | 'unchanged'; text: string };

function pushWords(
  words: string[],
  start: number,
  end: number,
  type: 'added' | 'removed',
  parts: DiffPart[],
): void {
  for (let k = start; k < end; k++) {
    const t = words[k];
    if (t != null) parts.push({ type, text: t });
  }
}

/** Simple word-level diff (greedy). Returns parts for unified display. */
function wordDiff(raw: string, edited: string): DiffPart[] {
  const rawWords = raw.split(/\s+/).filter(Boolean);
  const editedWords = edited.split(/\s+/).filter(Boolean);
  const parts: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < rawWords.length || j < editedWords.length) {
    const rw = rawWords[i];
    const ew = editedWords[j];
    if (i < rawWords.length && j < editedWords.length && rw != null && rw === ew) {
      parts.push({ type: 'unchanged', text: rw });
      i += 1;
      j += 1;
      continue;
    }
    const nextRawMatch = rw != null ? editedWords.indexOf(rw, j) : -1;
    const nextEditMatch = ew != null ? rawWords.indexOf(ew, i) : -1;
    if (nextRawMatch >= 0 && (nextEditMatch < 0 || nextRawMatch - j <= nextEditMatch - i)) {
      pushWords(editedWords, j, nextRawMatch, 'added', parts);
      j = nextRawMatch;
      continue;
    }
    if (nextEditMatch >= 0 && (nextRawMatch < 0 || nextEditMatch - i <= nextRawMatch - j)) {
      pushWords(rawWords, i, nextEditMatch, 'removed', parts);
      i = nextEditMatch;
      continue;
    }
    if (i < rawWords.length) {
      const t = rawWords[i];
      if (t != null) parts.push({ type: 'removed', text: t });
      i += 1;
    } else if (j < editedWords.length) {
      const t = editedWords[j];
      if (t != null) parts.push({ type: 'added', text: t });
      j += 1;
    }
  }
  return parts;
}

function DiffView({ raw, edited }: { raw: string; edited: string }) {
  const plainRaw = stripHtml(raw);
  const plainEdited = stripHtml(edited);
  const parts = React.useMemo(() => wordDiff(plainRaw, plainEdited), [plainRaw, plainEdited]);
  if (parts.length === 0) return <p className="text-sm text-muted-foreground">Sin diferencias.</p>;
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 font-mono text-xs leading-relaxed">
      {parts.map((p, i) => {
        if (p.type === 'unchanged') return <span key={i}>{p.text} </span>;
        if (p.type === 'removed')
          return (
            <span key={i} className="bg-destructive/20 text-destructive line-through">
              {p.text}{' '}
            </span>
          );
        return (
          <span key={i} className="bg-emerald-500/25 text-emerald-700 dark:text-emerald-400">
            {p.text}{' '}
          </span>
        );
      })}
    </div>
  );
}

function RawReportPanel({ report }: { report: ReturnType<typeof formatReport> }) {
  return (
    <div className="space-y-4">
      {report.executiveSummary ? (
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">Resumen ejecutivo</h3>
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed">
            {report.executiveSummary}
          </div>
        </div>
      ) : null}
      {report.decisions.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">Decisiones</h3>
          <ul className="list-inside list-disc space-y-1 text-sm">
            {report.decisions.map((d, i) => (
              <li key={i}>
                <strong>{d.title}</strong>: {d.description}
              </li>
            ))}
          </ul>
        </div>
      )}
      {report.checklist.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">Checklist</h3>
          <ul className="space-y-1 text-sm">
            {report.checklist.map((c, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className={c.met ? 'text-emerald-600' : 'text-muted-foreground'}>
                  {c.met ? '✓' : '○'}
                </span>
                {c.label}
              </li>
            ))}
          </ul>
        </div>
      )}
      {report.risksAndMitigations.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">Riesgos y mitigaciones</h3>
          <ul className="space-y-1 text-sm">
            {report.risksAndMitigations.map((r, i) => (
              <li key={i}>
                {r.risk}
                {r.mitigation ? ` — ${r.mitigation}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* eslint-disable complexity -- screen with many states and branches */
export function ConsolidationReviewContent({ echelonId }: { echelonId: string }) {
  const echelon = useEchelon(echelonId);
  const sessions = useEchelonSessions(echelonId);
  const transition = useEchelonTransition(echelonId);
  const updateEchelon = useUpdateEchelon();

  const e = echelon.data as Record<string, unknown> | undefined;
  const productId = e?.productId as string | undefined;
  const product = useProduct(productId ?? null);
  const productName = (product.data as { name?: string } | undefined)?.name ?? '—';

  const rawReport = React.useMemo(
    () => formatReport((e?.consolidatedReport as ConsolidationOutput | null) ?? null),
    [e?.consolidatedReport],
  );

  const [editedSummary, setEditedSummary] = React.useState('');
  const [hasInitializedEdit, setHasInitializedEdit] = React.useState(false);

  React.useEffect(() => {
    if (rawReport.executiveSummary && !hasInitializedEdit) {
      setEditedSummary(rawReport.executiveSummary);
      setHasInitializedEdit(true);
    }
  }, [rawReport.executiveSummary, hasInitializedEdit]);

  const version = typeof e?.version === 'number' ? e.version : 1;
  const state = (e?.state as string) ?? 'OPEN';
  const sessionsList = (sessions.data?.data ?? []) as { id: string }[];
  const name = (e?.name as string) ?? echelonId;

  const hasEdits =
    editedSummary.trim() !== '' && editedSummary.trim() !== rawReport.executiveSummary.trim();

  const handleApproveWithoutChanges = () => {
    transition.mutate(
      { event: 'CLOSE', version },
      {
        onSuccess: () => {
          toast.success('Echelon cerrado.');
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  const handleEditAndApprove = () => {
    const report = (e?.consolidatedReport as Record<string, unknown>) ?? {};
    const updatedReport = { ...report, executiveSummary: editedSummary };
    updateEchelon.mutate(
      { id: echelonId, consolidatedReport: updatedReport, version },
      {
        onSuccess: (updated) => {
          const nextVersion = (updated as { version?: number })?.version ?? version + 1;
          transition.mutate(
            { event: 'CLOSE', version: nextVersion },
            {
              onSuccess: () => toast.success('Reporte editado y echelon cerrado.'),
              onError: (err) => toast.error(err.message),
            },
          );
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  const handleReject = () => {
    transition.mutate(
      { event: 'REJECT', version },
      {
        onSuccess: () => toast.success('Cierre rechazado. El echelon volvió a En progreso.'),
        onError: (err) => toast.error(err.message),
      },
    );
  };

  if (echelon.isError) {
    return (
      <ErrorAlert
        message={echelon.error?.message ?? 'Error'}
        onRetry={() => void echelon.refetch()}
      />
    );
  }

  if (echelon.isLoading || echelon.data == null) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (state !== 'CLOSURE_REVIEW') {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <p className="font-medium">Este echelon no está en revisión de consolidación.</p>
          <p className="mt-1 text-muted-foreground">
            Estado actual:{' '}
            <Badge variant="outline" className={ECHELON_STATE_BADGE_CLASS[state] ?? ''}>
              {state.replace('_', ' ')}
            </Badge>
            . Solo podés revisar cuando el echelon está en <strong>CLOSURE_REVIEW</strong> (después
            de ejecutar la consolidación).
          </p>
        </div>
      </div>
    );
  }

  const isEmptyReport =
    !rawReport.executiveSummary &&
    rawReport.decisions.length === 0 &&
    rawReport.checklist.length === 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="page-title">Revisión de Consolidación</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {name} · {productName}
          </p>
        </div>
        <Badge
          variant="outline"
          className={`px-3 py-1 text-sm ${ECHELON_STATE_BADGE_CLASS[state] ?? ''}`}
        >
          {state.replace('_', ' ')}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="flex h-full flex-col">
          <CardHeader>
            <h2 className="section-title">Reporte generado por IA</h2>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="w-fit bg-zinc-400/10 text-xs text-zinc-400">
                <Bot className="mr-1 size-3" />
                IA
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {isEmptyReport ? (
              <p className="text-sm text-muted-foreground">
                Ejecutá &quot;Consolidar&quot; desde el detalle del echelon para generar el reporte.
              </p>
            ) : (
              <RawReportPanel report={rawReport} />
            )}
            <Separator className="my-4" />
            <p className="mb-3 text-sm font-medium">Sesiones ({sessionsList.length})</p>
            <div className="flex flex-col gap-2">
              {sessions.isLoading && <Skeleton className="h-20 w-full" />}
              {!sessions.isLoading &&
                sessionsList.length > 0 &&
                sessionsList.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-md bg-muted/30 p-2"
                  >
                    <span className="text-sm">Sesión</span>
                    <Link
                      href={`/sessions/${s.id}`}
                      className="inline-flex items-center gap-1 text-xs text-primary underline"
                    >
                      Ver
                      <ExternalLink className="size-3" />
                    </Link>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card className="flex h-full flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <h2 className="section-title">Edición y aprobación</h2>
            {hasEdits && (
              <Badge variant="secondary" className="text-xs">
                Hay cambios
              </Badge>
            )}
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Editá el resumen ejecutivo si hace falta. Luego aprobá sin cambios, guardá tu edición
              y aprobá, o rechazá el cierre.
            </p>
            <Tabs defaultValue="editar" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="editar">Editar</TabsTrigger>
                <TabsTrigger value="diff">
                  <GitCompare className="mr-1.5 size-3.5" />
                  Diff
                </TabsTrigger>
              </TabsList>
              <TabsContent value="editar" className="mt-3">
                <RichTextEditor
                  value={editedSummary}
                  onChange={setEditedSummary}
                  placeholder="Resumen ejecutivo..."
                  minHeight="220px"
                />
              </TabsContent>
              <TabsContent value="diff" className="mt-3">
                <p className="mb-2 text-xs text-muted-foreground">
                  <span className="rounded bg-destructive/20 px-1.5 text-destructive line-through">
                    Rojo
                  </span>{' '}
                  = quitado ·{' '}
                  <span className="rounded bg-emerald-500/25 px-1.5 text-emerald-700 dark:text-emerald-400">
                    Verde
                  </span>{' '}
                  = agregado
                </p>
                <DiffView raw={rawReport.executiveSummary} edited={editedSummary} />
              </TabsContent>
            </Tabs>
            <Separator />
            <div className="flex flex-col gap-3">
              <Button
                size="lg"
                className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={transition.isPending}
                onClick={handleApproveWithoutChanges}
              >
                <CheckCircle className="mr-2 size-4" />
                Aprobar sin cambios
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="w-full"
                disabled={transition.isPending || updateEchelon.isPending}
                onClick={handleEditAndApprove}
              >
                <CheckCircle className="mr-2 size-4" />
                Editar y aprobar
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={transition.isPending}
                onClick={handleReject}
              >
                <XCircle className="mr-2 size-4" />
                Rechazar (volver a En progreso)
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Aprobar cierra el echelon (CLOSED). Rechazar lo devuelve a En progreso.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
