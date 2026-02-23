import type { Role } from '@prisma/client';

import { AppError } from '@/lib/errors/app-error';
import { ErrorCode } from '@/lib/errors/error-codes';
import { err, ok, type Result } from '@/lib/result';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { InviteMemberInput } from '@/schemas/member.schema';

import type { MemberRecord, MemberRepository } from './member.repository';

export function createMemberService(repo: MemberRepository) {
  async function list(
    organizationId: string,
    query: { cursor?: string; limit?: number },
  ): Promise<Result<{ items: MemberRecord[]; nextCursor: string | null; hasMore: boolean }>> {
    const result = await repo.findMany(organizationId, {
      cursor: query.cursor,
      limit: query.limit ?? 20,
    });
    return ok(result);
  }

  /**
   * Invites a user by email to the organization.
   * Creates the Supabase auth user (or looks them up) then upserts the membership.
   */
  async function invite(
    organizationId: string,
    input: InviteMemberInput,
  ): Promise<Result<MemberRecord>> {
    const supabaseAdmin = createSupabaseAdminClient();

    // Look up existing user by email via admin API
    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      return err(
        new AppError(ErrorCode.INTERNAL_ERROR, 500, 'Failed to look up user', { listError }),
      );
    }

    let userId: string;
    const existing = listData.users.find((u) => u.email === input.email);

    if (existing) {
      userId = existing.id;
    } else {
      // Create user via invite (sends email)
      const { data: inviteData, error: inviteError } =
        await supabaseAdmin.auth.admin.inviteUserByEmail(input.email);
      if (inviteError ?? !inviteData.user) {
        return err(
          new AppError(ErrorCode.INTERNAL_ERROR, 500, 'Failed to invite user', { inviteError }),
        );
      }
      userId = inviteData.user.id;
    }

    // Check if already a member
    const existingMember = await repo.findByUserId(organizationId, userId);
    if (existingMember) {
      return err(
        new AppError(ErrorCode.CONFLICT, 409, 'User is already a member of this organization', {
          userId,
          organizationId,
        }),
      );
    }

    const member = await repo.create({ organizationId, userId, role: input.role });
    return ok(member);
  }

  async function updateRole(
    organizationId: string,
    userId: string,
    role: Role,
  ): Promise<Result<MemberRecord>> {
    const updated = await repo.updateRole(organizationId, userId, role);
    if (!updated) {
      return err(
        new AppError(ErrorCode.NOT_FOUND, 404, 'Member not found', { userId, organizationId }),
      );
    }
    return ok(updated);
  }

  async function remove(organizationId: string, userId: string): Promise<Result<void>> {
    const deleted = await repo.remove(organizationId, userId);
    if (!deleted) {
      return err(
        new AppError(ErrorCode.NOT_FOUND, 404, 'Member not found', { userId, organizationId }),
      );
    }
    return ok(undefined);
  }

  return { list, invite, updateRole, remove };
}

export type MemberService = ReturnType<typeof createMemberService>;
