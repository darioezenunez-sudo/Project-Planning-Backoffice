import type { Prisma, Role } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { decodeCursor, encodeCursor } from '@/lib/utils/pagination';

const memberSelect = {
  userId: true,
  organizationId: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      email: true,
      name: true,
    },
  },
} satisfies Prisma.OrganizationMemberSelect;

export type MemberRecord = Prisma.OrganizationMemberGetPayload<{
  select: typeof memberSelect;
}>;

export function createMemberRepository() {
  async function findByUserId(
    organizationId: string,
    userId: string,
  ): Promise<MemberRecord | null> {
    return prisma.organizationMember.findFirst({
      where: { organizationId, userId },
      select: memberSelect,
    });
  }

  async function findMany(
    organizationId: string,
    opts: { cursor?: string | null; limit: number },
  ): Promise<{ items: MemberRecord[]; nextCursor: string | null; hasMore: boolean }> {
    const cursorId = decodeCursor(opts.cursor);
    const take = opts.limit + 1;

    const items = await prisma.organizationMember.findMany({
      where: { organizationId },
      select: memberSelect,
      cursor: cursorId
        ? { organizationId_userId: { organizationId, userId: cursorId } }
        : undefined,
      skip: cursorId ? 1 : 0,
      take,
      orderBy: { createdAt: 'asc' },
    });

    const hasMore = items.length > opts.limit;
    const page = hasMore ? items.slice(0, opts.limit) : items;
    const lastItem = page[page.length - 1];
    const nextCursor = hasMore && lastItem ? encodeCursor(lastItem.userId) : null;

    return { items: page, nextCursor, hasMore };
  }

  async function create(data: {
    organizationId: string;
    userId: string;
    role: Role;
  }): Promise<MemberRecord> {
    return prisma.organizationMember.create({ data, select: memberSelect });
  }

  async function updateRole(
    organizationId: string,
    userId: string,
    role: Role,
  ): Promise<MemberRecord | null> {
    try {
      return await prisma.organizationMember.update({
        where: { organizationId_userId: { organizationId, userId } },
        data: { role },
        select: memberSelect,
      });
    } catch {
      return null;
    }
  }

  async function remove(organizationId: string, userId: string): Promise<boolean> {
    try {
      await prisma.organizationMember.delete({
        where: { organizationId_userId: { organizationId, userId } },
      });
      return true;
    } catch {
      return false;
    }
  }

  return { findByUserId, findMany, create, updateRole, remove };
}

export type MemberRepository = ReturnType<typeof createMemberRepository>;
