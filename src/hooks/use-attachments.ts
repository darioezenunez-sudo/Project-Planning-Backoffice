'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { AttachmentListQuery, CreateAttachmentInput } from '@/schemas/attachment.schema';

import { useTenant } from './use-tenant';

export type AttachmentItem = Record<string, unknown>;

type AttachmentsListResponse = {
  data: AttachmentItem[];
  meta?: { pagination?: { cursor?: string; hasMore: boolean; limit: number } };
};

const attachmentKeys = {
  all: ['attachments'] as const,
  list: (params: AttachmentListQuery) => [...attachmentKeys.all, 'list', params] as const,
};

/**
 * GET /api/v1/attachments — list by echelonId and/or summaryId.
 */
export function useAttachments(params: {
  echelonId?: string | null;
  summaryId?: string | null;
  cursor?: string;
  limit?: number;
}) {
  const { organizationId } = useTenant();
  const { echelonId, summaryId, cursor, limit = 20 } = params;

  const queryParams: AttachmentListQuery = {
    limit,
    ...(cursor ? { cursor } : {}),
    ...(echelonId ? { echelonId } : {}),
    ...(summaryId ? { summaryId } : {}),
  };

  return useQuery({
    queryKey: attachmentKeys.list(queryParams),
    queryFn: async (): Promise<AttachmentsListResponse> => {
      const search = new URLSearchParams();
      search.set('limit', String(queryParams.limit));
      if (queryParams.cursor) search.set('cursor', queryParams.cursor);
      if (queryParams.echelonId) search.set('echelonId', queryParams.echelonId);
      if (queryParams.summaryId) search.set('summaryId', queryParams.summaryId);
      const res = await fetch(`/api/v1/attachments?${search.toString()}`, {
        headers: { 'X-Organization-Id': organizationId ?? '' },
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as {
        data?: AttachmentItem[];
        meta?: { pagination?: { cursor?: string; hasMore: boolean; limit: number } };
      };
      return {
        data: json.data ?? [],
        meta: json.meta,
      };
    },
    enabled: !!organizationId && (!!echelonId || !!summaryId),
  });
}

/**
 * POST /api/v1/attachments — upload (body must include content as base64).
 */
export function useUploadAttachment() {
  const { organizationId } = useTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAttachmentInput) => {
      const res = await fetch('/api/v1/attachments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-Id': organizationId ?? '',
        },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ data: AttachmentItem }>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: attachmentKeys.all });
    },
  });
}

export type AttachmentWithUrl = AttachmentItem & {
  signedUrl?: string;
  filename?: string;
  mimeType?: string;
  fileSize?: number;
  createdAt?: string;
  version?: number;
};

/**
 * GET /api/v1/attachments/:id — fetch attachment with signed download URL.
 * Use for download link or image preview (enable when needed to avoid extra requests).
 */
export function useAttachmentDownloadUrl(
  attachmentId: string | null,
  options?: { enabled?: boolean },
) {
  const { organizationId } = useTenant();
  const enabled = options?.enabled ?? !!attachmentId;
  return useQuery({
    queryKey: [...attachmentKeys.all, 'download', attachmentId],
    queryFn: async (): Promise<AttachmentWithUrl> => {
      const res = await fetch(`/api/v1/attachments/${attachmentId ?? ''}`, {
        headers: { 'X-Organization-Id': organizationId ?? '' },
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { data: AttachmentWithUrl };
      return json.data;
    },
    enabled: !!organizationId && !!attachmentId && enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * DELETE /api/v1/attachments/:id?version=N — soft delete.
 */
export function useDeleteAttachment() {
  const { organizationId } = useTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, version }: { id: string; version: number }) => {
      const res = await fetch(`/api/v1/attachments/${id}?version=${encodeURIComponent(version)}`, {
        method: 'DELETE',
        headers: { 'X-Organization-Id': organizationId ?? '' },
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: attachmentKeys.all });
    },
  });
}
