import { describe, expect, it } from 'vitest';

import { AppError } from '@/lib/errors/app-error';
import { ErrorCode } from '@/lib/errors/error-codes';
import { type EchelonEvent, transitionEchelon } from '@/modules/echelon/echelon.state-machine';

// ─── Helper ────────────────────────────────────────────────────────────────────

function expectTransitionOk(
  state: Parameters<typeof transitionEchelon>[0],
  event: EchelonEvent,
  expected: string,
) {
  const result = transitionEchelon(state, event);
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.value).toBe(expected);
}

function expectTransitionErr(state: Parameters<typeof transitionEchelon>[0], event: EchelonEvent) {
  const result = transitionEchelon(state, event);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    const error = result.error as AppError;
    expect(error.code).toBe(ErrorCode.ECHELON_INVALID_TRANSITION);
    expect(error.httpStatus).toBe(422);
  }
}

// ─── Valid transitions ─────────────────────────────────────────────────────────

describe('transitionEchelon — valid transitions', () => {
  it('OPEN + START_SESSION → IN_PROGRESS', () => {
    expectTransitionOk('OPEN', 'START_SESSION', 'IN_PROGRESS');
  });

  it('IN_PROGRESS + CONSOLIDATE → CLOSING', () => {
    expectTransitionOk('IN_PROGRESS', 'CONSOLIDATE', 'CLOSING');
  });

  it('CLOSING + CONSOLIDATION_COMPLETE → CLOSURE_REVIEW', () => {
    expectTransitionOk('CLOSING', 'CONSOLIDATION_COMPLETE', 'CLOSURE_REVIEW');
  });

  it('CLOSURE_REVIEW + CLOSE → CLOSED', () => {
    expectTransitionOk('CLOSURE_REVIEW', 'CLOSE', 'CLOSED');
  });
});

// ─── Invalid transitions from OPEN ────────────────────────────────────────────

describe('transitionEchelon — invalid from OPEN', () => {
  it('OPEN + CONSOLIDATE → error', () => {
    expectTransitionErr('OPEN', 'CONSOLIDATE');
  });
  it('OPEN + CONSOLIDATION_COMPLETE → error', () => {
    expectTransitionErr('OPEN', 'CONSOLIDATION_COMPLETE');
  });
  it('OPEN + CLOSE → error', () => {
    expectTransitionErr('OPEN', 'CLOSE');
  });
});

// ─── Invalid transitions from IN_PROGRESS ─────────────────────────────────────

describe('transitionEchelon — invalid from IN_PROGRESS', () => {
  it('IN_PROGRESS + START_SESSION → error', () => {
    expectTransitionErr('IN_PROGRESS', 'START_SESSION');
  });
  it('IN_PROGRESS + CONSOLIDATION_COMPLETE → error', () => {
    expectTransitionErr('IN_PROGRESS', 'CONSOLIDATION_COMPLETE');
  });
  it('IN_PROGRESS + CLOSE → error', () => {
    expectTransitionErr('IN_PROGRESS', 'CLOSE');
  });
});

// ─── Invalid transitions from CLOSING ─────────────────────────────────────────

describe('transitionEchelon — invalid from CLOSING', () => {
  it('CLOSING + START_SESSION → error', () => {
    expectTransitionErr('CLOSING', 'START_SESSION');
  });
  it('CLOSING + CONSOLIDATE → error', () => {
    expectTransitionErr('CLOSING', 'CONSOLIDATE');
  });
  it('CLOSING + CLOSE → error', () => {
    expectTransitionErr('CLOSING', 'CLOSE');
  });
});

// ─── Invalid transitions from CLOSURE_REVIEW ──────────────────────────────────

describe('transitionEchelon — invalid from CLOSURE_REVIEW', () => {
  it('CLOSURE_REVIEW + START_SESSION → error', () => {
    expectTransitionErr('CLOSURE_REVIEW', 'START_SESSION');
  });
  it('CLOSURE_REVIEW + CONSOLIDATE → error', () => {
    expectTransitionErr('CLOSURE_REVIEW', 'CONSOLIDATE');
  });
  it('CLOSURE_REVIEW + CONSOLIDATION_COMPLETE → error', () => {
    expectTransitionErr('CLOSURE_REVIEW', 'CONSOLIDATION_COMPLETE');
  });
});

// ─── CLOSED state — all events invalid ────────────────────────────────────────

describe('transitionEchelon — CLOSED is terminal (all events fail)', () => {
  it('CLOSED + START_SESSION → error', () => {
    expectTransitionErr('CLOSED', 'START_SESSION');
  });
  it('CLOSED + CONSOLIDATE → error', () => {
    expectTransitionErr('CLOSED', 'CONSOLIDATE');
  });
  it('CLOSED + CONSOLIDATION_COMPLETE → error', () => {
    expectTransitionErr('CLOSED', 'CONSOLIDATION_COMPLETE');
  });
  it('CLOSED + CLOSE → error', () => {
    expectTransitionErr('CLOSED', 'CLOSE');
  });
});
