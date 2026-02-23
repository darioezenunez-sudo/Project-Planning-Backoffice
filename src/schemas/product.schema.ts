import { z } from 'zod';

import { listQuerySchema, standardColumnsSchema, uuidSchema } from './shared.schema';

// ─── Entity ────────────────────────────────────────────────────────────────────

export const productSchema = standardColumnsSchema.extend({
  organizationId: uuidSchema,
  companyId: uuidSchema,
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable(),
});

export type Product = z.infer<typeof productSchema>;

// ─── Mutations ─────────────────────────────────────────────────────────────────

export const createProductSchema = z.object({
  companyId: uuidSchema,
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(1000).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional(),
    version: z.number().int().min(1, 'Version is required for optimistic locking'),
  })
  .refine((d) => d.name !== undefined || d.description !== undefined, {
    message: 'At least one field must be provided',
  });

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// ─── Query ─────────────────────────────────────────────────────────────────────

export const listProductsQuerySchema = listQuerySchema.extend({
  companyId: uuidSchema.optional(),
});

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
