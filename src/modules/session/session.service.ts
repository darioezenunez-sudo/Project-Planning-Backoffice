import { AppError } from '@/lib/errors/app-error';
import { ErrorCode } from '@/lib/errors/error-codes';
import { err, ok, type Result } from '@/lib/result';
import type { EchelonRepository } from '@/modules/echelon/echelon.repository';
import { transitionEchelon } from '@/modules/echelon/echelon.state-machine';
import type {
  CreateSessionInput,
  ListSessionsQuery,
  UpdateSessionInput,
} from '@/schemas/session.schema';

import type { SessionRepository, SessionRow } from './session.repository';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type SessionListResult = {
  items: SessionRow[];
  nextCursor: string | null;
  hasMore: boolean;
};

// ─── Service factory ───────────────────────────────────────────────────────────

export function createSessionService(
  sessionRepo: SessionRepository,
  echelonRepo: EchelonRepository,
) {
  async function listByEchelon(
    echelonId: string,
    organizationId: string,
    query: ListSessionsQuery,
  ): Promise<Result<SessionListResult>> {
    const echelon = await echelonRepo.findById(echelonId, organizationId);
    if (!echelon) {
      return err(new AppError(ErrorCode.NOT_FOUND, 404, `Echelon ${echelonId} not found`));
    }
    const result = await sessionRepo.findManyByEchelon(echelonId, organizationId, query);
    return ok(result);
  }

  async function getById(id: string, organizationId: string): Promise<Result<SessionRow>> {
    const session = await sessionRepo.findById(id, organizationId);
    if (!session) {
      return err(new AppError(ErrorCode.NOT_FOUND, 404, `Session ${id} not found`));
    }
    return ok(session);
  }

  async function create(
    echelonId: string,
    organizationId: string,
    input: CreateSessionInput,
  ): Promise<Result<SessionRow>> {
    const echelon = await echelonRepo.findById(echelonId, organizationId);
    if (!echelon) {
      return err(new AppError(ErrorCode.NOT_FOUND, 404, `Echelon ${echelonId} not found`));
    }

    // Prevent adding sessions to a closed/closing echelon.
    if (echelon.state === 'CLOSED' || echelon.state === 'CLOSING') {
      return err(
        new AppError(
          ErrorCode.UNPROCESSABLE_ENTITY,
          422,
          `Cannot add a session to an echelon in state '${echelon.state}'`,
          { echelonId, state: echelon.state },
        ),
      );
    }

    // First session transitions echelon from OPEN → IN_PROGRESS.
    if (echelon.state === 'OPEN') {
      const transition = transitionEchelon(echelon.state, 'START_SESSION');
      if (!transition.ok) return err(transition.error);

      const updated = await echelonRepo.updateState(
        echelonId,
        organizationId,
        transition.value,
        echelon.version,
      );
      if (!updated) {
        return err(
          new AppError(
            ErrorCode.CONFLICT,
            409,
            'Version conflict on echelon while starting session',
            { echelonId },
          ),
        );
      }
    }

    const sessionNumber = await sessionRepo.getNextSessionNumber(echelonId);
    const session = await sessionRepo.create(echelonId, organizationId, sessionNumber, input);
    return ok(session);
  }

  async function update(
    id: string,
    organizationId: string,
    input: UpdateSessionInput,
  ): Promise<Result<SessionRow>> {
    const existing = await sessionRepo.findById(id, organizationId);
    if (!existing) {
      return err(new AppError(ErrorCode.NOT_FOUND, 404, `Session ${id} not found`));
    }

    const updated = await sessionRepo.update(id, organizationId, input);
    if (!updated) {
      return err(
        new AppError(
          ErrorCode.CONFLICT,
          409,
          'Version conflict — the session was modified by another request',
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
    const existing = await sessionRepo.findById(id, organizationId);
    if (!existing) {
      return err(new AppError(ErrorCode.NOT_FOUND, 404, `Session ${id} not found`));
    }

    const deleted = await sessionRepo.softDelete(id, organizationId, version);
    if (!deleted) {
      return err(
        new AppError(
          ErrorCode.CONFLICT,
          409,
          'Version conflict — the session was modified by another request',
          { currentVersion: existing.version, requestedVersion: version },
        ),
      );
    }
    return ok(undefined);
  }

  return { listByEchelon, getById, create, update, remove };
}

export type SessionService = ReturnType<typeof createSessionService>;
