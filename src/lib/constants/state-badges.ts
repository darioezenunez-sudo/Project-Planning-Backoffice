/**
 * Echelon & Summary FSM badge styles (G2 — design tokens).
 * Uses CSS variables from globals.css: --state-open, --state-in-progress, etc.
 */
const stateBase = (varName: string) =>
  `border bg-[hsl(var(${varName})/0.1)] text-[hsl(var(${varName}))] border-[hsl(var(${varName})/0.2)]`;

export const ECHELON_STATE_BADGE_CLASS: Record<string, string> = {
  OPEN: stateBase('--state-open'),
  IN_PROGRESS: stateBase('--state-in-progress'),
  CLOSING: stateBase('--state-closing'),
  CLOSURE_REVIEW: stateBase('--state-closure-review'),
  CLOSED: stateBase('--state-closed'),
};

export const SUMMARY_STATE_BADGE_CLASS: Record<string, string> = {
  DRAFT: stateBase('--state-draft'),
  REVIEW: stateBase('--state-review'),
  EDITED: stateBase('--state-edited'),
  VALIDATED: stateBase('--state-validated'),
};
