import { z } from 'zod';

import { listQuerySchema, standardColumnsSchema, uuidSchema } from './shared.schema';

// ─── Entity ────────────────────────────────────────────────────────────────────

export const companySchema = standardColumnsSchema.extend({
  organizationId: uuidSchema,
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable(),
  industry: z.string().max(100).nullable(),
  website: z.string().url().nullable().or(z.literal('')).transform((v) => v || null),
});

export type Company = z.infer<typeof companySchema>;

// ─── Mutations ─────────────────────────────────────────────────────────────────

export const createCompanySchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(1000).optional(),
  industry: z.string().max(100).optional(),
  website: z
    .string()
    .url('Must be a valid URL')
    .optional()
    .or(z.literal(''))
    .transform((v) => v || undefined),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

export const updateCompanySchema = createCompanySchema.partial().extend({
  version: z.number().int().min(1, 'Version is required for optimistic locking'),
});

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

// ─── Query ─────────────────────────────────────────────────────────────────────

export const listCompaniesQuerySchema = listQuerySchema;

export type ListCompaniesQuery = z.infer<typeof listCompaniesQuerySchema>;
