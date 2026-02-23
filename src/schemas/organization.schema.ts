import { z } from 'zod';

export const organizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number().int(),
});

export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(2).max(120),
  version: z.number().int().min(1),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
