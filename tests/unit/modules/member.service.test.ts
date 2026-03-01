import type { Role } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppError } from '@/lib/errors/app-error';

// vi.hoisted so refs are valid inside vi.mock factories
const mockListUsers = vi.hoisted(() => vi.fn());
const mockInviteUserByEmail = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    auth: {
      admin: {
        listUsers: mockListUsers,
        inviteUserByEmail: mockInviteUserByEmail,
      },
    },
  })),
}));

import { createMemberService } from '@/modules/member/member.service';

const ORG_ID = 'org-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';
const EMAIL = 'test@example.com';

const fakeMember = {
  id: 'mbr-1',
  organizationId: ORG_ID,
  userId: USER_ID,
  role: 'MEMBER' as Role,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  version: 1,
};

const mockRepo = {
  findMany: vi.fn(),
  findByUserId: vi.fn(),
  create: vi.fn(),
  updateRole: vi.fn(),
  remove: vi.fn(),
};

describe('MemberService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('returns ok with the paginated result from the repository', async () => {
      const fakeResult = { items: [fakeMember], nextCursor: null, hasMore: false };
      mockRepo.findMany.mockResolvedValue(fakeResult);
      const service = createMemberService(mockRepo);

      const result = await service.list(ORG_ID, { limit: 10 });

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(fakeResult);
      expect(mockRepo.findMany).toHaveBeenCalledWith(ORG_ID, { cursor: undefined, limit: 10 });
    });

    it('defaults limit to 20 when not provided', async () => {
      mockRepo.findMany.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
      const service = createMemberService(mockRepo);

      await service.list(ORG_ID, {});

      expect(mockRepo.findMany).toHaveBeenCalledWith(ORG_ID, { cursor: undefined, limit: 20 });
    });
  });

  describe('invite', () => {
    it('uses the existing Supabase user when the email is already registered', async () => {
      mockListUsers.mockResolvedValue({
        data: { users: [{ id: USER_ID, email: EMAIL }] },
        error: null,
      });
      mockRepo.findByUserId.mockResolvedValue(null);
      mockRepo.create.mockResolvedValue(fakeMember);
      const service = createMemberService(mockRepo);

      const result = await service.invite(ORG_ID, { email: EMAIL, role: 'MEMBER' });

      expect(result.ok).toBe(true);
      expect(mockInviteUserByEmail).not.toHaveBeenCalled();
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID, userId: USER_ID, role: 'MEMBER' }),
      );
    });

    it('invites a new Supabase user when the email is not registered', async () => {
      const newUserId = 'new-user-id';
      mockListUsers.mockResolvedValue({ data: { users: [] }, error: null });
      mockInviteUserByEmail.mockResolvedValue({
        data: { user: { id: newUserId } },
        error: null,
      });
      mockRepo.findByUserId.mockResolvedValue(null);
      mockRepo.create.mockResolvedValue({ ...fakeMember, userId: newUserId });
      const service = createMemberService(mockRepo);

      const result = await service.invite(ORG_ID, { email: EMAIL, role: 'ADMIN' });

      expect(result.ok).toBe(true);
      expect(mockInviteUserByEmail).toHaveBeenCalledWith(EMAIL);
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: newUserId, role: 'ADMIN' }),
      );
    });

    it('returns CONFLICT when the user is already a member', async () => {
      mockListUsers.mockResolvedValue({
        data: { users: [{ id: USER_ID, email: EMAIL }] },
        error: null,
      });
      mockRepo.findByUserId.mockResolvedValue(fakeMember);
      const service = createMemberService(mockRepo);

      const result = await service.invite(ORG_ID, { email: EMAIL, role: 'MEMBER' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        const error = result.error as AppError;
        expect(error.httpStatus).toBe(409);
        expect(error.code).toBe('CONFLICT');
      }
    });

    it('returns INTERNAL_ERROR when the Supabase admin listUsers call fails', async () => {
      mockListUsers.mockResolvedValue({
        data: { users: [] },
        error: { message: 'Admin API unavailable' },
      });
      const service = createMemberService(mockRepo);

      const result = await service.invite(ORG_ID, { email: EMAIL, role: 'MEMBER' });

      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(500);
    });

    it('returns INTERNAL_ERROR when inviteUserByEmail fails', async () => {
      mockListUsers.mockResolvedValue({ data: { users: [] }, error: null });
      mockInviteUserByEmail.mockResolvedValue({
        data: { user: null },
        error: { message: 'invite failed' },
      });
      const service = createMemberService(mockRepo);

      const result = await service.invite(ORG_ID, { email: EMAIL, role: 'MEMBER' });

      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(500);
    });
  });

  describe('updateRole', () => {
    it('returns ok with the updated member when found', async () => {
      const updated = { ...fakeMember, role: 'ADMIN' as Role };
      mockRepo.updateRole.mockResolvedValue(updated);
      const service = createMemberService(mockRepo);

      const result = await service.updateRole(ORG_ID, USER_ID, 'ADMIN');

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.role).toBe('ADMIN');
    });

    it('returns NOT_FOUND when the member does not exist', async () => {
      mockRepo.updateRole.mockResolvedValue(null);
      const service = createMemberService(mockRepo);

      const result = await service.updateRole(ORG_ID, USER_ID, 'ADMIN');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        const error = result.error as AppError;
        expect(error.httpStatus).toBe(404);
        expect(error.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('remove', () => {
    it('returns ok when the member is successfully removed', async () => {
      mockRepo.remove.mockResolvedValue(fakeMember);
      const service = createMemberService(mockRepo);

      const result = await service.remove(ORG_ID, USER_ID);

      expect(result.ok).toBe(true);
    });

    it('returns NOT_FOUND when the member does not exist', async () => {
      mockRepo.remove.mockResolvedValue(null);
      const service = createMemberService(mockRepo);

      const result = await service.remove(ORG_ID, USER_ID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        const error = result.error as AppError;
        expect(error.httpStatus).toBe(404);
        expect(error.code).toBe('NOT_FOUND');
      }
    });
  });
});
