'use client';

import {
  Download,
  FileText,
  Image as ImageIcon,
  File as FileIcon,
  Trash2,
  Eye,
} from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';
import { toast } from 'sonner';

import { ErrorAlert } from '@/components/shared/error-alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useAttachments,
  useAttachmentDownloadUrl,
  useDeleteAttachment,
  type AttachmentItem,
} from '@/hooks/use-attachments';

type AttachmentRow = AttachmentItem & {
  id: string;
  filename?: string;
  mimeType?: string;
  fileSize?: number;
  createdAt?: string;
  version?: number;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes.toString() + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getIcon(mimeType: string | undefined) {
  if (!mimeType) return <FileIcon className="size-8 text-muted-foreground" />;
  if (mimeType.startsWith('image/')) return <ImageIcon className="size-8 text-muted-foreground" />;
  if (mimeType.includes('pdf') || mimeType.includes('text'))
    return <FileText className="size-8 text-muted-foreground" />;
  return <FileIcon className="size-8 text-muted-foreground" />;
}

function isImage(mimeType: string | undefined): boolean {
  return !!mimeType?.startsWith('image/');
}

function renderPreviewContent(
  previewId: string | null,
  urlData: { signedUrl?: string } | undefined,
) {
  if (previewId && urlData?.signedUrl) {
    return (
      <Image
        src={urlData.signedUrl}
        alt="Preview"
        className="max-h-[70vh] max-w-full object-contain"
        width={800}
        height={600}
        style={{ height: 'auto' }}
        unoptimized
      />
    );
  }
  if (previewId) {
    return <Skeleton className="h-64 w-64" />;
  }
  return null;
}

type AttachmentsGalleryProps = {
  echelonId?: string | null;
  summaryId?: string | null;
  emptyMessage?: string;
};

/* eslint-disable complexity -- gallery grid with preview, download, delete actions */
export function AttachmentsGallery({
  echelonId,
  summaryId,
  emptyMessage = 'No hay adjuntos.',
}: AttachmentsGalleryProps) {
  const { data, isLoading, isError, error, refetch } = useAttachments({
    echelonId,
    summaryId,
    limit: 50,
  });
  const deleteAttachment = useDeleteAttachment();
  const [downloadId, setDownloadId] = React.useState<string | null>(null);
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<AttachmentRow | null>(null);

  const activeId = downloadId ?? previewId;
  const { data: urlData } = useAttachmentDownloadUrl(activeId, { enabled: !!activeId });

  React.useEffect(() => {
    if (!urlData?.signedUrl || !activeId) return;
    if (downloadId) {
      window.open(urlData.signedUrl, '_blank', 'noopener,noreferrer');
      setDownloadId(null);
    }
  }, [urlData?.signedUrl, downloadId, activeId]);

  const items = (data?.data ?? []) as unknown as AttachmentRow[];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorAlert
        message={error instanceof Error ? error.message : 'Error al cargar adjuntos'}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const previewItem = items.find((a) => a.id === previewId);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {items.map((att) => (
          <div
            key={att.id}
            className="flex flex-col overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md"
          >
            <div className="flex min-h-[100px] flex-1 flex-col items-center justify-center gap-2 border-b bg-muted/30 p-3">
              {previewId === att.id && urlData?.signedUrl && isImage(att.mimeType) ? (
                <Image
                  src={urlData.signedUrl}
                  alt={att.filename ?? ''}
                  className="max-h-20 w-full object-contain"
                  width={80}
                  height={80}
                  style={{ height: 'auto' }}
                  unoptimized
                />
              ) : (
                getIcon(att.mimeType)
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1 p-2">
              <p className="truncate text-xs font-medium" title={att.filename ?? att.id}>
                {att.filename ?? att.id}
              </p>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                {att.fileSize != null && <span>{formatSize(att.fileSize)}</span>}
                {att.createdAt != null && (
                  <span>· {new Date(att.createdAt).toLocaleDateString()}</span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-1 border-t p-2">
              {isImage(att.mimeType) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setPreviewId((prev) => (prev === att.id ? null : att.id));
                  }}
                >
                  <Eye className="mr-1 size-3" />
                  Ver
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  setDownloadId(att.id);
                }}
              >
                <Download className="mr-1 size-3" />
                Descargar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                onClick={() => {
                  setDeleteTarget(att);
                }}
              >
                <Trash2 className="mr-1 size-3" />
                Eliminar
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog
        open={!!previewId}
        onOpenChange={(open) => {
          if (!open) setPreviewId(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewItem?.filename ?? 'Vista previa'}</DialogTitle>
          </DialogHeader>
          <div className="flex min-h-[200px] justify-center overflow-auto">
            {renderPreviewContent(previewId, urlData)}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar adjunto</DialogTitle>
          </DialogHeader>
          {deleteTarget && (
            <p className="text-sm text-muted-foreground">
              ¿Eliminar «{deleteTarget.filename ?? deleteTarget.id}»? Esta acción no se puede
              deshacer.
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteTarget(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleteAttachment.isPending || !deleteTarget}
              onClick={() => {
                if (!deleteTarget) return;
                const version = typeof deleteTarget.version === 'number' ? deleteTarget.version : 1;
                deleteAttachment.mutate(
                  { id: deleteTarget.id, version },
                  {
                    onSuccess: () => {
                      setDeleteTarget(null);
                      toast.success('Adjunto eliminado');
                    },
                    onError: (err) => toast.error(err.message),
                  },
                );
              }}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
