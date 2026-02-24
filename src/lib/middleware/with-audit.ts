import type { AuditAction } from '@prisma/client';
import type { NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { createAuditRepository } from '@/modules/audit/audit.repository';
import { createAuditService } from '@/modules/audit/audit.service';

import type { Middleware } from './compose';

// ─── Constants ──────────────────────────────────────────────────────────────

const METHOD_ACTION: Partial<Record<string, AuditAction>> = {
  POST: 'CREATE',
  PATCH: 'UPDATE',
  PUT: 'UPDATE',
  DELETE: 'DELETE',
};

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

// ─── Singleton audit service ─────────────────────────────────────────────────

const auditService = createAuditService(createAuditRepository());

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extracts the last UUID segment from a URL path — typically the entity ID. */
function extractIdFromPath(pathname: string): string | null {
  const matches = pathname.match(UUID_RE);
  return matches && matches.length > 0 ? (matches[matches.length - 1] ?? null) : null;
}

/** For POST responses, tries to read `data.id` from the JSON body without consuming it. */
async function extractIdFromResponseBody(response: NextResponse): Promise<string | null> {
  try {
    const json = (await response.clone().json()) as unknown;
    if (json === null || typeof json !== 'object' || !('data' in json)) return null;
    const data = (json as { data: unknown }).data;
    if (data === null || typeof data !== 'object' || !('id' in data)) return null;
    const id = (data as { id: unknown }).id;
    return typeof id === 'string' ? id : null;
  } catch (err) {
    logger.warn({ err }, 'withAudit: failed to parse response body for entity ID');
    return null;
  }
}

// ─── Middleware factory ───────────────────────────────────────────────────────

/**
 * Automatically writes an audit log entry after every successful mutation
 * (POST → CREATE, PATCH/PUT → UPDATE, DELETE → DELETE).
 *
 * Entity ID is sourced from:
 *   - For PATCH/DELETE: last UUID found in the URL path.
 *   - For POST: `data.id` in the JSON response body.
 *
 * Audit write is fire-and-forget — failures are logged but never surface
 * to the client.
 *
 * @example
 * export const POST = compose(withErrorHandling, withAuth, withTenant, withAudit('Company'))(handler);
 */
export function withAudit(entityType: string): Middleware {
  return (handler) =>
    async (req: NextRequest, context): Promise<NextResponse> => {
      const response = await handler(req, context);

      const action = METHOD_ACTION[req.method];
      if (!action || response.status < 200 || response.status >= 300) {
        return response;
      }

      const url = new URL(req.url);
      let entityId: string | null = null;

      if (req.method === 'POST') {
        entityId = await extractIdFromResponseBody(response);
      }

      // Fallback to URL path for POST, primary source for PATCH/DELETE
      if (!entityId) {
        entityId = extractIdFromPath(url.pathname);
      }

      if (entityId) {
        void auditService.logFromContext(entityType, entityId, action, {
          ipAddress:
            req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? undefined,
          userAgent: req.headers.get('user-agent') ?? undefined,
        });
      }

      return response;
    };
}
