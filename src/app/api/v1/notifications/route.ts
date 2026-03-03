import type { NextRequest } from 'next/server';

import { compose } from '@/lib/middleware/compose';
import { withAuth } from '@/lib/middleware/with-auth';
import { withErrorHandling } from '@/lib/middleware/with-error-handling';
import { withTenant } from '@/lib/middleware/with-tenant';
import { getRequestContext } from '@/lib/request-context';
import { apiSuccess } from '@/lib/utils/api-response';
import { createAuditRepository } from '@/modules/audit/audit.repository';
import { createAuditService } from '@/modules/audit/audit.service';

const repo = createAuditRepository();
const service = createAuditService(repo);

const NOTIFICATION_LIMIT = 10;
const FETCH_LIMIT = 50;

type NotificationType = 'echelon_state' | 'consolidation' | 'member_added' | 'other';

function toNotificationType(entityType: string, action: string): NotificationType | null {
  if (entityType === 'Echelon' && (action === 'TRANSITION' || action === 'UPDATE'))
    return 'echelon_state';
  if (entityType === 'ExecutiveSummary' && (action === 'UPDATE' || action === 'CREATE'))
    return 'consolidation';
  if (entityType === 'OrganizationMember' && action === 'CREATE') return 'member_added';
  return null;
}

function echelonMessage(diff: unknown): string {
  const d = diff as { toState?: string; fromState?: string } | undefined;
  const toState = d?.toState;
  if (toState === 'CLOSURE_REVIEW') return 'Un echelon está listo para revisión.';
  if (toState === 'CLOSED') return 'Un echelon fue cerrado.';
  if (toState) return `Echelon transitó a ${toState}.`;
  return 'Estado de echelon actualizado.';
}

function buildMessage(
  entityType: string,
  action: string,
  diff: unknown,
  _entityId: string,
): string {
  if (entityType === 'Echelon' && (action === 'TRANSITION' || action === 'UPDATE'))
    return echelonMessage(diff);
  if (entityType === 'ExecutiveSummary' && (action === 'UPDATE' || action === 'CREATE'))
    return 'Consolidación AI completada.';
  if (entityType === 'OrganizationMember' && action === 'CREATE')
    return 'Nuevo miembro agregado a la organización.';
  return `${entityType} ${action}`;
}

// GET /api/v1/notifications — últimas notificaciones (desde audit_logs), max 10
export const GET = compose(
  withErrorHandling,
  withAuth,
  withTenant,
)(async (_req: NextRequest) => {
  const ctx = getRequestContext();
  const organizationId = ctx?.organizationId ?? '';

  const rows = await service.getByEntity({
    organizationId,
    limit: FETCH_LIMIT,
  });

  const notifications: Array<{
    id: string;
    type: NotificationType;
    message: string;
    createdAt: string;
    entityType?: string;
    entityId?: string;
  }> = [];

  for (const row of rows) {
    const type = toNotificationType(row.entityType, row.action);
    if (type == null) continue;
    notifications.push({
      id: row.id,
      type,
      message: buildMessage(row.entityType, row.action, row.diff, row.entityId),
      createdAt: row.createdAt.toISOString(),
      entityType: row.entityType,
      entityId: row.entityId,
    });
    if (notifications.length >= NOTIFICATION_LIMIT) break;
  }

  return apiSuccess(notifications);
});
