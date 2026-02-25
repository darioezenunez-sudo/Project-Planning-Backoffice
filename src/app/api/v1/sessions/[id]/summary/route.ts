import type { NextRequest } from 'next/server';

import { assistantPostSummarySchema } from '@/contracts/assistant-api';
import {
  invalidateContextCache,
  invalidateContextCacheIfValidated,
} from '@/lib/cache/context-cache';
import { AppError } from '@/lib/errors/app-error';
import { ErrorCode } from '@/lib/errors/error-codes';
import { compose } from '@/lib/middleware/compose';
import type { RouteContext } from '@/lib/middleware/compose';
import { withAudit } from '@/lib/middleware/with-audit';
import { withAuth } from '@/lib/middleware/with-auth';
import { withErrorHandling } from '@/lib/middleware/with-error-handling';
import { withIdempotency } from '@/lib/middleware/with-idempotency';
import { withTenant } from '@/lib/middleware/with-tenant';
import { getRequestContext } from '@/lib/request-context';
import { apiSuccess } from '@/lib/utils/api-response';
import { createEchelonRepository } from '@/modules/echelon/echelon.repository';
import { createEchelonService } from '@/modules/echelon/echelon.service';
import { createRequiredFieldRepository } from '@/modules/echelon/required-field.repository';
import { createSessionRepository } from '@/modules/session/session.repository';
import { createSummaryRepository } from '@/modules/summary/summary.repository';
import { createSummaryService } from '@/modules/summary/summary.service';
import { transitionSummarySchema } from '@/schemas/summary.schema';

const summaryRepo = createSummaryRepository();
const sessionRepo = createSessionRepository();
const echelonRepo = createEchelonRepository();
const requiredFieldRepo = createRequiredFieldRepository();

const summaryService = createSummaryService(summaryRepo, sessionRepo);
const echelonService = createEchelonService(echelonRepo, requiredFieldRepo);

async function resolveSessionId(context: RouteContext): Promise<string> {
  const params = await context.params;
  const id = params['id'];
  if (!id || Array.isArray(id)) throw new Error('Invalid route param: id');
  return id;
}

// GET /api/v1/sessions/:id/summary
export const GET = compose(
  withErrorHandling,
  withAuth,
  withTenant,
)(async (_req: NextRequest, context: RouteContext) => {
  const sessionId = await resolveSessionId(context);
  const ctx = getRequestContext();
  const organizationId = ctx?.organizationId ?? '';

  const result = await summaryService.getBySession(sessionId, organizationId);
  if (!result.ok) throw result.error;

  return apiSuccess(result.value);
});

// POST /api/v1/sessions/:id/summary — Idempotent. Assistant or backoffice. Optionally transitions echelon OPEN→IN_PROGRESS.
export const POST = compose(
  withErrorHandling,
  withAuth,
  withTenant,
  withIdempotency('POST /api/v1/sessions/:id/summary'),
  withAudit('ExecutiveSummary'),
)(async (req: NextRequest, context: RouteContext) => {
  const sessionId = await resolveSessionId(context);
  const ctx = getRequestContext();
  const organizationId = ctx?.organizationId ?? '';

  const body = (await req.json()) as unknown;
  const parsed = assistantPostSummarySchema.parse(body);
  const input = {
    rawContent: parsed.rawContent,
    ...(parsed.embedding !== undefined ? { embedding: parsed.embedding } : {}),
  };

  const result = await summaryService.create(sessionId, organizationId, input);
  if (!result.ok) throw result.error;

  const session = await sessionRepo.findById(sessionId, organizationId);
  if (session !== null) await invalidateContextCache(session.echelonId);
  if (session !== null) {
    const echelonResult = await echelonService.getById(session.echelonId, organizationId);
    if (echelonResult.ok && echelonResult.value.state === 'OPEN') {
      await echelonService.transition(
        session.echelonId,
        organizationId,
        'START_SESSION',
        echelonResult.value.version,
      );
    }
  }

  return apiSuccess(result.value, {}, 201);
});

// PATCH /api/v1/sessions/:id/summary — Transition summary state (e.g. VALIDATE → VALIDATED). Invalidates context cache when VALIDATED.
export const PATCH = compose(
  withErrorHandling,
  withAuth,
  withTenant,
  withAudit('ExecutiveSummary'),
)(async (req: NextRequest, context: RouteContext) => {
  const sessionId = await resolveSessionId(context);
  const ctx = getRequestContext();
  const organizationId = ctx?.organizationId ?? '';

  const summaryResult = await summaryService.getBySession(sessionId, organizationId);
  if (!summaryResult.ok) throw summaryResult.error;
  const summary = summaryResult.value;
  if (summary === null) {
    throw new AppError(ErrorCode.NOT_FOUND, 404, 'Summary not found for session');
  }

  const body = (await req.json()) as unknown;
  const input = transitionSummarySchema.parse(body);

  const result = await summaryService.transition(summary.id, organizationId, input);
  if (!result.ok) throw result.error;

  await invalidateContextCacheIfValidated(result.value);

  return apiSuccess(result.value);
});
