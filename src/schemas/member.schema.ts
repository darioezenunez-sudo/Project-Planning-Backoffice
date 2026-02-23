import { z } from 'zod';

const roleEnum = z.enum(['VIEWER', 'MEMBER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN']);

export const memberSchema = z.object({
  userId: z.string().uuid(),
  organizationId: z.string().uuid(),
  role: roleEnum,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: roleEnum.default('MEMBER'),
});

export const updateMemberRoleSchema = z.object({
  role: roleEnum,
});

export const listMembersQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
