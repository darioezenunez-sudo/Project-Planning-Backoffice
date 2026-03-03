'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { InviteMemberInput, UpdateMemberRoleInput } from '@/schemas/member.schema';

import { useTenant } from './use-tenant';

export type MemberItem = {
  userId: string;
  organizationId: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; email: string | null; name: string | null };
};

type MembersListResponse = {
  data: MemberItem[];
  meta?: { pagination?: { cursor?: string; hasMore: boolean; limit: number } };
};

const membersKeys = {
  all: ['members'] as const,
  list: (orgId: string, params: { cursor?: string; limit?: number }) =>
    [...membersKeys.all, orgId, params] as const,
};

/**
 * GET /api/v1/organizations/:id/members — list members of the current org.
 */
export function useMembers(params?: { cursor?: string; limit?: number }) {
  const { organizationId } = useTenant();
  const limit = params?.limit ?? 50;

  return useQuery({
    queryKey: membersKeys.list(organizationId ?? '', { cursor: params?.cursor, limit }),
    queryFn: async (): Promise<MembersListResponse> => {
      const search = new URLSearchParams({ limit: String(limit) });
      if (params?.cursor) search.set('cursor', params.cursor);
      const res = await fetch(
        `/api/v1/organizations/${organizationId ?? ''}/members?${search.toString()}`,
        { headers: { 'X-Organization-Id': organizationId ?? '' } },
      );
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as {
        data?: MemberItem[];
        meta?: { pagination?: { cursor?: string; hasMore: boolean; limit: number } };
      };
      return { data: json.data ?? [], meta: json.meta };
    },
    enabled: !!organizationId,
  });
}

/**
 * POST /api/v1/organizations/:id/members — invite member (ADMIN/SUPER_ADMIN).
 */
export function useInviteMember() {
  const { organizationId } = useTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: InviteMemberInput) => {
      const res = await fetch(`/api/v1/organizations/${organizationId ?? ''}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-Id': organizationId ?? '',
        },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ data: MemberItem }>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: membersKeys.all });
    },
  });
}

/**
 * PATCH /api/v1/organizations/:id/members/:userId — update role (ADMIN/SUPER_ADMIN).
 */
export function useUpdateMemberRole() {
  const { organizationId } = useTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role }: UpdateMemberRoleInput & { userId: string }) => {
      const res = await fetch(`/api/v1/organizations/${organizationId ?? ''}/members/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-Id': organizationId ?? '',
        },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ data: MemberItem }>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: membersKeys.all });
    },
  });
}

/**
 * DELETE /api/v1/organizations/:id/members/:userId — remove member (ADMIN/SUPER_ADMIN).
 */
export function useRemoveMember() {
  const { organizationId } = useTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/v1/organizations/${organizationId ?? ''}/members/${userId}`, {
        method: 'DELETE',
        headers: { 'X-Organization-Id': organizationId ?? '' },
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: membersKeys.all });
    },
  });
}
