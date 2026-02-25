import type { SummaryState } from '@prisma/client';

import { AppError } from '@/lib/errors/app-error';
import { ErrorCode } from '@/lib/errors/error-codes';
import { err, ok, type Result } from '@/lib/result';

// ─── Events ────────────────────────────────────────────────────────────────────

export type SummaryEvent =
  | 'SUBMIT' // DRAFT → REVIEW  or  EDITED → REVIEW (re-submit after edit)
  | 'REQUEST_EDIT' // REVIEW → EDITED
  | 'VALIDATE'; // REVIEW → VALIDATED  or  EDITED → VALIDATED

// ─── Transition table ──────────────────────────────────────────────────────────

const TRANSITIONS: Record<SummaryState, Partial<Record<SummaryEvent, SummaryState>>> = {
  DRAFT: { SUBMIT: 'REVIEW' },
  REVIEW: { REQUEST_EDIT: 'EDITED', VALIDATE: 'VALIDATED' },
  EDITED: { SUBMIT: 'REVIEW', VALIDATE: 'VALIDATED' },
  VALIDATED: {},
};

// ─── Pure FSM function ─────────────────────────────────────────────────────────

/**
 * Pure state-machine transition. No side effects.
 * Returns the next state or an UNPROCESSABLE_ENTITY error.
 */
export function transitionSummary(state: SummaryState, event: SummaryEvent): Result<SummaryState> {
  const next = TRANSITIONS[state][event];
  if (!next) {
    return err(
      new AppError(
        ErrorCode.UNPROCESSABLE_ENTITY,
        422,
        `Cannot apply event '${event}' to summary in state '${state}'`,
        { state, event },
      ),
    );
  }
  return ok(next);
}
