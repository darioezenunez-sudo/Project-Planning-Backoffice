import { z } from 'zod';

import { uuidSchema } from '@/schemas/shared.schema';

// ─── Device Enrollment (POST /auth/devices) ────────────────────────────────────

/** Input for enrolling a device (Assistant machine). */
export const enrollDeviceSchema = z.object({
  machineId: z.string().min(1).max(255),
  userId: uuidSchema,
  osInfo: z
    .record(z.union([z.string(), z.number(), z.boolean()]))
    .optional()
    .nullable(),
});
export type EnrollDeviceInput = z.infer<typeof enrollDeviceSchema>;

/** Device row as returned by API (no secrets). */
export const deviceResponseSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  machineId: z.string(),
  userId: uuidSchema,
  osInfo: z.record(z.unknown()).nullable(),
  enrolledAt: z.coerce.date(),
  lastSeenAt: z.coerce.date().nullable(),
  revokedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type DeviceResponse = z.infer<typeof deviceResponseSchema>;

/** Short-lived token payload returned by GET /auth/devices/[machineId] (validation). */
export const deviceValidationResponseSchema = z.object({
  machineId: z.string(),
  organizationId: uuidSchema,
  userId: uuidSchema,
  /** Short-lived token for Assistant to call other API endpoints. */
  accessToken: z.string(),
  /** ISO8601 expiry. */
  expiresAt: z.string().datetime({ offset: true }),
});
export type DeviceValidationResponse = z.infer<typeof deviceValidationResponseSchema>;
