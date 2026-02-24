import { AppError } from '@/lib/errors/app-error';
import { ErrorCode } from '@/lib/errors/error-codes';
import { err, ok, type Result } from '@/lib/result';
import type { SessionRepository } from '@/modules/session/session.repository';
import type {
  CreateSummaryInput,
  ListSummariesQuery,
  TransitionSummaryInput,
  UpdateSummaryInput,
} from '@/schemas/summary.schema';

import type { SummaryRepository, SummaryRow } from './summary.repository';
import { transitionSummary } from './summary.state-machine';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type SummaryListResult = {
  items: SummaryRow[];
  nextCursor: string | null;
  hasMore: boolean;
};

// ─── Service factory ───────────────────────────────────────────────────────────

export function createSummaryService(
  summaryRepo: SummaryRepository,
  sessionRepo: SessionRepository,
) {
  async function listByEchelon(
    echelonId: string,
    organizationId: string,
    query: ListSummariesQuery,
  ): Promise<Result<SummaryListResult>> {
    const result = await summaryRepo.findManyByEchelon(echelonId, organizationId, query);
    return ok(result);
  }

  async function getById(id: string, organizationId: string): Promise<Result<SummaryRow>> {
    const summary = await summaryRepo.findById(id, organizationId);
    if (!summary) {
      return err(new AppError(ErrorCode.NOT_FOUND, 404, `ExecutiveSummary ${id} not found`));
    }
    return ok(summary);
  }

  async function getBySession(
    sessionId: string,
    organizationId: string,
  ): Promise<Result<SummaryRow | null>> {
    const summary = await summaryRepo.findBySession(sessionId, organizationId);
    return ok(summary);
  }

  async function create(
    sessionId: string,
    organizationId: string,
    input: CreateSummaryInput,
  ): Promise<Result<SummaryRow>> {
    const session = await sessionRepo.findById(sessionId, organizationId);
    if (!session) {
      return err(new AppError(ErrorCode.NOT_FOUND, 404, `Session ${sessionId} not found`));
    }

    // Prevent duplicate summaries per session.
    const existing = await summaryRepo.findBySession(sessionId, organizationId);
    if (existing) {
      return err(
        new AppError(ErrorCode.CONFLICT, 409, `A summary already exists for session ${sessionId}`, {
          sessionId,
          summaryId: existing.id,
        }),
      );
    }

    const summary = await summaryRepo.create(sessionId, session.echelonId, organizationId, input);
    return ok(summary);
  }

  async function update(
    id: string,
    organizationId: string,
    input: UpdateSummaryInput,
  ): Promise<Result<SummaryRow>> {
    const existing = await summaryRepo.findById(id, organizationId);
    if (!existing) {
      return err(new AppError(ErrorCode.NOT_FOUND, 404, `ExecutiveSummary ${id} not found`));
    }

    const updated = await summaryRepo.update(id, organizationId, input);
    if (!updated) {
      return err(
        new AppError(
          ErrorCode.CONFLICT,
          409,
          'Version conflict — the summary was modified by another request',
          { currentVersion: existing.version, requestedVersion: input.version },
        ),
      );
    }
    return ok(updated);
  }

  async function transition(
    id: string,
    organizationId: string,
    input: TransitionSummaryInput,
  ): Promise<Result<SummaryRow>> {
    const existing = await summaryRepo.findById(id, organizationId);
    if (!existing) {
      return err(new AppError(ErrorCode.NOT_FOUND, 404, `ExecutiveSummary ${id} not found`));
    }

    const fsm = transitionSummary(existing.state, input.event);
    if (!fsm.ok) return err(fsm.error);

    const now = new Date();
    const timestamps = {
      reviewedAt:
        input.event === 'REQUEST_EDIT' ||
        (input.event === 'VALIDATE' && existing.state === 'REVIEW')
          ? now
          : undefined,
      editedAt:
        (input.event === 'VALIDATE' && existing.state === 'EDITED') ||
        (input.event === 'SUBMIT' && existing.state === 'EDITED')
          ? now
          : undefined,
      validatedAt: input.event === 'VALIDATE' ? now : undefined,
    };

    const updated = await summaryRepo.updateState(
      id,
      organizationId,
      fsm.value,
      timestamps,
      input.version,
    );
    if (!updated) {
      return err(
        new AppError(
          ErrorCode.CONFLICT,
          409,
          'Version conflict — the summary was modified by another request',
          { currentVersion: existing.version, requestedVersion: input.version },
        ),
      );
    }
    return ok(updated);
  }

  async function remove(
    id: string,
    organizationId: string,
    version: number,
  ): Promise<Result<void>> {
    const existing = await summaryRepo.findById(id, organizationId);
    if (!existing) {
      return err(new AppError(ErrorCode.NOT_FOUND, 404, `ExecutiveSummary ${id} not found`));
    }

    const deleted = await summaryRepo.softDelete(id, organizationId, version);
    if (!deleted) {
      return err(
        new AppError(
          ErrorCode.CONFLICT,
          409,
          'Version conflict — the summary was modified by another request',
          { currentVersion: existing.version, requestedVersion: version },
        ),
      );
    }
    return ok(undefined);
  }

  return { listByEchelon, getById, getBySession, create, update, transition, remove };
}

export type SummaryService = ReturnType<typeof createSummaryService>;
