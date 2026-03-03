'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  CalendarDays,
  ChevronRight,
  Clock,
  MoreHorizontal,
  Plus,
  Smartphone,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';

import { LaunchAssistantModal } from '@/components/screens/echelons/launch-assistant-modal';
import { AttachmentsGallery } from '@/components/shared/attachments-gallery';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorAlert } from '@/components/shared/error-alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAttachments, useUploadAttachment } from '@/hooks/use-attachments';
import {
  useEchelon,
  useEchelonSessions,
  useEchelonTransition,
  useUpdateEchelon,
  useDeleteEchelon,
} from '@/hooks/use-echelons';
import {
  useCreateRequiredField,
  useRequiredFields,
  useUpdateRequiredField,
  useDeleteRequiredField,
} from '@/hooks/use-required-fields';
import { useCreateSession } from '@/hooks/use-sessions';
import { ECHELON_STATE_BADGE_CLASS } from '@/lib/constants/state-badges';

type RequiredFieldRow = {
  id: string;
  label?: string;
  description?: string | null;
  isMet?: boolean;
  metByUserId?: string | null;
  updatedAt?: string;
  version?: number;
  [key: string]: unknown;
};

type SessionRow = {
  id: string;
  sessionNumber?: number;
  notes?: string | null;
  createdAt?: string;
  [key: string]: unknown;
};

/** FSM-aware action bar: botones según estado del echelon (OPEN → … → CLOSED). */
function EchelonActionBar({
  echelonId,
  name,
  state,
  version,
  completedCount,
  totalFields,
}: {
  echelonId: string;
  name: string;
  state: string;
  version: number;
  completedCount: number;
  totalFields: number;
}) {
  const transition = useEchelonTransition(echelonId);
  const updateEchelon = useUpdateEchelon();
  const deleteEchelon = useDeleteEchelon();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [editName, setEditName] = React.useState(name);

  React.useEffect(() => {
    setEditName(name);
  }, [name]);

  const runTransition = (
    event: 'START_SESSION' | 'CONSOLIDATE' | 'CONSOLIDATION_COMPLETE' | 'CLOSE' | 'REJECT',
  ) => {
    transition.mutate(
      { event, version },
      {
        onSuccess: () => toast.success('Estado actualizado'),
        onError: (err) => toast.error(err.message),
      },
    );
  };

  const handleEditSubmit = () => {
    updateEchelon.mutate(
      { id: echelonId, name: editName, version },
      {
        onSuccess: () => {
          setEditOpen(false);
          toast.success('Echelon actualizado');
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  const handleDeleteConfirm = () => {
    deleteEchelon.mutate(
      { id: echelonId, version },
      {
        onSuccess: () => {
          setDeleteOpen(false);
          toast.success('Echelon eliminado');
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 border-t bg-background/95 px-6 py-4 backdrop-blur">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Estado: <span className="font-medium">{state.replace('_', ' ')}</span> — {completedCount}/
          {totalFields} campos
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          {state === 'OPEN' && (
            <>
              <Button
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => runTransition('START_SESSION')}
                disabled={transition.isPending}
              >
                Iniciar
              </Button>
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full sm:w-auto">
                    Editar
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Editar echelon</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-2 py-2">
                    <Label htmlFor="echelon-name">Nombre</Label>
                    <Input
                      id="echelon-name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleEditSubmit} disabled={updateEchelon.isPending}>
                      Guardar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full text-destructive sm:w-auto">
                    Eliminar
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>¿Eliminar echelon?</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-muted-foreground">
                    Esta acción no se puede deshacer. El echelon se marcará como eliminado.
                  </p>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                      Cancelar
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDeleteConfirm}
                      disabled={deleteEchelon.isPending}
                    >
                      Eliminar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
          {state === 'IN_PROGRESS' && (
            <>
              <Button
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => runTransition('CONSOLIDATE')}
                disabled={transition.isPending}
              >
                Cerrar
              </Button>
              <Button size="sm" className="w-full sm:w-auto" asChild>
                <Link href={`/echelons/${echelonId}/consolidation`}>
                  Consolidar
                  <ChevronRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full sm:w-auto">
                    Editar
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Editar echelon</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-2 py-2">
                    <Label htmlFor="echelon-name-inprogress">Nombre</Label>
                    <Input
                      id="echelon-name-inprogress"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleEditSubmit} disabled={updateEchelon.isPending}>
                      Guardar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
          {state === 'CLOSING' && (
            <Button
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => runTransition('CONSOLIDATION_COMPLETE')}
              disabled={transition.isPending}
            >
              Enviar a revisión
            </Button>
          )}
          {state === 'CLOSURE_REVIEW' && (
            <>
              <Button
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => runTransition('CLOSE')}
                disabled={transition.isPending}
              >
                Aprobar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => runTransition('REJECT')}
                disabled={transition.isPending}
              >
                Rechazar
              </Button>
            </>
          )}
          {state === 'CLOSED' && (
            <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
              <Link href={`/echelons/${echelonId}/consolidation`}>
                Ver consolidación
                <ChevronRight className="ml-2 size-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* eslint-disable complexity -- screen with FSM actions, required fields, sessions, attachments */
export function EchelonDetailContent({ echelonId }: { echelonId: string }) {
  const echelon = useEchelon(echelonId);
  const sessions = useEchelonSessions(echelonId);
  const requiredFields = useRequiredFields(echelonId);
  const updateRequiredField = useUpdateRequiredField(echelonId);
  const createRequiredField = useCreateRequiredField(echelonId);
  const deleteRequiredField = useDeleteRequiredField(echelonId);
  const createSession = useCreateSession(echelonId);
  const attachments = useAttachments({ echelonId });
  const uploadAttachment = useUploadAttachment();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [addFieldOpen, setAddFieldOpen] = React.useState(false);
  const [launchModalOpen, setLaunchModalOpen] = React.useState(false);
  const [newFieldLabel, setNewFieldLabel] = React.useState('');
  const [newFieldDescription, setNewFieldDescription] = React.useState('');

  const handleFileSelect = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
        uploadAttachment.mutate(
          {
            echelonId,
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            fileSize: file.size,
            content: base64 ?? '',
          },
          {
            onSuccess: () => toast.success('Adjunto subido'),
            onError: (err) => toast.error(err.message),
          },
        );
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    },
    [echelonId, uploadAttachment],
  );

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
  const version = typeof e.version === 'number' ? e.version : 1;
  const sessionsList = (sessions.data?.data ?? []) as SessionRow[];
  const fieldsList = (requiredFields.data ?? []) as RequiredFieldRow[];
  const attachmentsList = (attachments.data?.data ?? []) as Array<{
    id: string;
    filename?: string;
    fileSize?: number;
    version?: number;
    signedUrl?: string;
    [key: string]: unknown;
  }>;
  const completedCount = fieldsList.filter((f) => f.isMet === true).length;
  const totalFields = fieldsList.length;
  const progress = totalFields > 0 ? Math.round((completedCount / totalFields) * 100) : 0;
  const lastSession = sessionsList[0];
  const lastSessionDate = lastSession?.createdAt;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <LaunchAssistantModal
        echelonId={echelonId}
        open={launchModalOpen}
        onOpenChange={setLaunchModalOpen}
      />
      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="page-title">{name}</h1>
            <Badge
              variant="outline"
              className={`mt-1 inline-block px-3 py-1 text-sm ${ECHELON_STATE_BADGE_CLASS[state] ?? ''}`}
            >
              {state.replace('_', ' ')}
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLaunchModalOpen(true)}
            className="shrink-0"
          >
            <Smartphone className="mr-2 size-4" />
            Conectar Assistant
          </Button>
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
              {attachmentsList.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requerimientos" className="mt-4">
          <div className="mb-4 flex justify-end">
            <Dialog open={addFieldOpen} onOpenChange={setAddFieldOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="mr-2 size-3.5" />
                  Agregar campo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nuevo campo requerido</DialogTitle>
                </DialogHeader>
                <div className="grid gap-2 py-2">
                  <Label htmlFor="field-label">Etiqueta</Label>
                  <Input
                    id="field-label"
                    value={newFieldLabel}
                    onChange={(e) => setNewFieldLabel(e.target.value)}
                    placeholder="Ej: Documento de aprobación"
                  />
                  <Label htmlFor="field-desc">Descripción (opcional)</Label>
                  <Input
                    id="field-desc"
                    value={newFieldDescription}
                    onChange={(e) => setNewFieldDescription(e.target.value)}
                    placeholder="Descripción del campo"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddFieldOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => {
                      if (!newFieldLabel.trim()) return;
                      createRequiredField.mutate(
                        {
                          label: newFieldLabel.trim(),
                          description: newFieldDescription.trim() || undefined,
                          sortOrder: totalFields,
                        },
                        {
                          onSuccess: () => {
                            setNewFieldLabel('');
                            setNewFieldDescription('');
                            setAddFieldOpen(false);
                            toast.success('Campo creado');
                          },
                          onError: (err) => toast.error(err.message),
                        },
                      );
                    }}
                    disabled={createRequiredField.isPending || !newFieldLabel.trim()}
                  >
                    Crear
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
            <EmptyState
              title="No hay campos requeridos"
              description="Agregá los campos requeridos para este echelon."
              action={
                <Button size="sm" variant="outline" onClick={() => setAddFieldOpen(true)}>
                  <Plus className="mr-2 size-3.5" />
                  Agregar campo
                </Button>
              }
            />
          )}
          {!requiredFields.isLoading && !requiredFields.isError && fieldsList.length > 0 && (
            <div className="flex flex-col gap-2">
              {fieldsList.map((f) => (
                <Card key={f.id} className="rounded-lg border p-4 hover:bg-muted/30">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={f.isMet === true}
                      className="mt-0.5"
                      onCheckedChange={(checked) => {
                        const nextMet = checked === true;
                        const version = typeof f.version === 'number' ? f.version : 1;
                        updateRequiredField.mutate(
                          { id: f.id, isMet: nextMet, version },
                          {
                            onSuccess: () => toast.success('Campo actualizado'),
                            onError: (err) => toast.error(err.message),
                          },
                        );
                      }}
                      disabled={updateRequiredField.isPending}
                    />
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
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            const v = typeof f.version === 'number' ? f.version : 1;
                            deleteRequiredField.mutate(
                              { id: f.id, version: v },
                              {
                                onSuccess: () => toast.success('Campo eliminado'),
                                onError: (err) => toast.error(err.message),
                              },
                            );
                          }}
                          disabled={deleteRequiredField.isPending}
                        >
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
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                createSession.mutate(
                  {},
                  {
                    onSuccess: () => toast.success('Sesión creada'),
                    onError: (err) => toast.error(err.message),
                  },
                )
              }
              disabled={createSession.isPending}
            >
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
            <EmptyState
              title="No hay sesiones"
              description="Creá la primera sesión para este echelon."
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    createSession.mutate(
                      {},
                      {
                        onSuccess: () => toast.success('Sesión creada'),
                        onError: (err) => toast.error(err.message),
                      },
                    )
                  }
                  disabled={createSession.isPending}
                >
                  Nueva sesión
                </Button>
              }
            />
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
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="*/*"
            onChange={handleFileSelect}
          />
          <div className="mb-4 flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadAttachment.isPending}
            >
              <Upload className="mr-2 size-3.5" />
              Subir adjunto
            </Button>
          </div>
          <AttachmentsGallery
            echelonId={echelonId}
            emptyMessage="No hay adjuntos. Subí uno con el botón de arriba."
          />
        </TabsContent>
      </Tabs>

      <EchelonActionBar
        echelonId={echelonId}
        name={name}
        state={state}
        version={version}
        completedCount={completedCount}
        totalFields={totalFields}
      />
    </div>
  );
}
