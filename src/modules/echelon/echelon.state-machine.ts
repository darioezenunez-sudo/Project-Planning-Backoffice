import type { EchelonState } from '@prisma/client';

import { AppError } from '@/lib/errors/app-error';
import { ErrorCode } from '@/lib/errors/error-codes';
import { err, ok, type Result } from '@/lib/result';

// ─── Events ────────────────────────────────────────────────────────────────────

export type EchelonEvent =
  | 'START_SESSION' // OPEN → IN_PROGRESS (first session created)
  | 'CONSOLIDATE' // IN_PROGRESS → CLOSING (consolidation queued)
  | 'CONSOLIDATION_COMPLETE' // CLOSING → CLOSURE_REVIEW (Fase 4: AI job done)
  | 'CLOSE'; // CLOSURE_REVIEW → CLOSED

// ─── Transition table ──────────────────────────────────────────────────────────

const TRANSITIONS: Record<EchelonState, Partial<Record<EchelonEvent, EchelonState>>> = {
  OPEN: { START_SESSION: 'IN_PROGRESS' },
  IN_PROGRESS: { CONSOLIDATE: 'CLOSING' },
  CLOSING: { CONSOLIDATION_COMPLETE: 'CLOSURE_REVIEW' },
  CLOSURE_REVIEW: { CLOSE: 'CLOSED' },
  CLOSED: {},
};

// ─── Pure FSM function ─────────────────────────────────────────────────────────

/**
 * Pure state-machine transition. No side effects.
 * Returns the next state or an ECHELON_INVALID_TRANSITION error.
 */
export function transitionEchelon(state: EchelonState, event: EchelonEvent): Result<EchelonState> {
  const next = TRANSITIONS[state][event];
  if (!next) {
    return err(
      new AppError(
        ErrorCode.ECHELON_INVALID_TRANSITION,
        422,
        `Cannot apply event '${event}' to echelon in state '${state}'`,
        { state, event },
      ),
    );
  }
  return ok(next);
}
