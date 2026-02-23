import type { AuditAction } from '@prisma/client';

import { logger } from '@/lib/logger';
import { getRequestContext } from '@/lib/request-context';

import type { AuditRepository, CreateAuditLogInput } from './audit.repository';

export function createAuditService(repo: AuditRepository) {
  /**
   * Logs a mutation to the audit trail.
   * Errors are caught and logged — audit logging should never break the main flow.
   */
  async function log(input: Omit<CreateAuditLogInput, 'requestId'>): Promise<void> {
    const ctx = getRequestContext();
    try {
      await repo.create({ ...input, requestId: ctx?.requestId });
    } catch (err) {
      // Audit failure is non-fatal — log and continue.
      logger.error({ err, input }, 'audit.service: failed to write audit log');
    }
  }

  /**
   * Convenience wrapper: auto-fills organizationId, actorId from request context.
   */
  async function logFromContext(
    entityType: string,
    entityId: string,
    action: AuditAction,
    options: { diff?: unknown; actorEmail?: string; ipAddress?: string; userAgent?: string } = {},
  ): Promise<void> {
    const ctx = getRequestContext();
    await log({
      organizationId: ctx?.organizationId,
      actorId: ctx?.userId,
      actorEmail: options.actorEmail,
      entityType,
      entityId,
      action,
      diff: options.diff,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
    });
  }

  async function getByEntity(params: {
    organizationId?: string;
    entityType?: string;
    entityId?: string;
    limit?: number;
    cursor?: string;
  }) {
    return repo.findMany(params);
  }

  return { log, logFromContext, getByEntity };
}

export type AuditService = ReturnType<typeof createAuditService>;
