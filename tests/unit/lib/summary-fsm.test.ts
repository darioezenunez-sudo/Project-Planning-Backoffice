import { describe, expect, it } from 'vitest';

import { AppError } from '@/lib/errors/app-error';
import { ErrorCode } from '@/lib/errors/error-codes';
import { type SummaryEvent, transitionSummary } from '@/modules/summary/summary.state-machine';

// ─── Helper ────────────────────────────────────────────────────────────────────

function expectTransitionOk(
  state: Parameters<typeof transitionSummary>[0],
  event: SummaryEvent,
  expected: string,
) {
  const result = transitionSummary(state, event);
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.value).toBe(expected);
}

function expectTransitionErr(state: Parameters<typeof transitionSummary>[0], event: SummaryEvent) {
  const result = transitionSummary(state, event);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    const error = result.error as AppError;
    expect(error.code).toBe(ErrorCode.UNPROCESSABLE_ENTITY);
    expect(error.httpStatus).toBe(422);
  }
}

// ─── Valid transitions ─────────────────────────────────────────────────────────

describe('transitionSummary — valid transitions', () => {
  it('DRAFT + SUBMIT → REVIEW', () => {
    expectTransitionOk('DRAFT', 'SUBMIT', 'REVIEW');
  });

  it('REVIEW + REQUEST_EDIT → EDITED', () => {
    expectTransitionOk('REVIEW', 'REQUEST_EDIT', 'EDITED');
  });

  it('REVIEW + VALIDATE → VALIDATED', () => {
    expectTransitionOk('REVIEW', 'VALIDATE', 'VALIDATED');
  });

  it('EDITED + SUBMIT → REVIEW (re-submit after edit)', () => {
    expectTransitionOk('EDITED', 'SUBMIT', 'REVIEW');
  });

  it('EDITED + VALIDATE → VALIDATED', () => {
    expectTransitionOk('EDITED', 'VALIDATE', 'VALIDATED');
  });
});

// ─── Invalid transitions from DRAFT ───────────────────────────────────────────

describe('transitionSummary — invalid from DRAFT', () => {
  it('DRAFT + REQUEST_EDIT → error', () => {
    expectTransitionErr('DRAFT', 'REQUEST_EDIT');
  });
  it('DRAFT + VALIDATE → error', () => {
    expectTransitionErr('DRAFT', 'VALIDATE');
  });
});

// ─── Invalid transitions from REVIEW ──────────────────────────────────────────

describe('transitionSummary — invalid from REVIEW', () => {
  it('REVIEW + SUBMIT → error', () => {
    expectTransitionErr('REVIEW', 'SUBMIT');
  });
});

// ─── Invalid transitions from EDITED ──────────────────────────────────────────

describe('transitionSummary — invalid from EDITED', () => {
  it('EDITED + REQUEST_EDIT → error', () => {
    expectTransitionErr('EDITED', 'REQUEST_EDIT');
  });
});

// ─── VALIDATED state — all events invalid ─────────────────────────────────────

describe('transitionSummary — VALIDATED is terminal (all events fail)', () => {
  it('VALIDATED + SUBMIT → error', () => {
    expectTransitionErr('VALIDATED', 'SUBMIT');
  });
  it('VALIDATED + REQUEST_EDIT → error', () => {
    expectTransitionErr('VALIDATED', 'REQUEST_EDIT');
  });
  it('VALIDATED + VALIDATE → error', () => {
    expectTransitionErr('VALIDATED', 'VALIDATE');
  });
});
