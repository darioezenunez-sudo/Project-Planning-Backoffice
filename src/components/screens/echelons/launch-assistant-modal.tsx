'use client';

import { Copy, Smartphone } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useLaunchPayload } from '@/hooks/use-launch-payload';

type LaunchAssistantModalProps = {
  echelonId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function LaunchAssistantModal({ echelonId, open, onOpenChange }: LaunchAssistantModalProps) {
  const launch = useLaunchPayload(echelonId);
  const [_copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (open && !launch.data && !launch.isPending && !launch.isError) {
      launch.mutate();
    }
  }, [open, echelonId, launch]);

  React.useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  const handleCopy = React.useCallback(() => {
    const url = launch.data?.deepLinkUrl;
    if (!url) return;
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast.success('Enlace copiado');
      setTimeout(() => setCopied(false), 2000);
    });
  }, [launch.data?.deepLinkUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="size-5" />
            Conectar Assistant
          </DialogTitle>
          <DialogDescription>
            Usá este enlace para abrir el echelon en la app de escritorio (Electron). El enlace
            incluye el contexto actual y es válido por 24 horas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {launch.isPending && (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          )}
          {launch.isError && (
            <p className="text-sm text-destructive">
              {launch.error instanceof Error ? launch.error.message : 'Error al generar el enlace'}
            </p>
          )}
          {launch.data && (
            <>
              <div className="space-y-2">
                <Label htmlFor="launch-url">Enlace de conexión</Label>
                <div className="flex gap-2">
                  <Input
                    id="launch-url"
                    readOnly
                    value={launch.data.deepLinkUrl}
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                    title="Copiar"
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Instrucciones</p>
                <ol className="mt-2 list-inside list-decimal space-y-1">
                  <li>Copiá el enlace con el botón.</li>
                  <li>
                    En la app Assistant, pegá el enlace o escaneá el código si está disponible.
                  </li>
                  <li>La app se conectará con este echelon y el contexto actual.</li>
                </ol>
                <p className="mt-2 text-xs">
                  El enlace expira en 24 h. Generá uno nuevo si necesitás conectarte de nuevo.
                </p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
