export const EXAM_STATES = Object.freeze([
  "NORMAL",
  "AT_RISK",
  "AFFECTED",
  "CONTINUITY_ACTIVE",
  "RECOVERING",
  "RECOVERED",
]);

const TRANSITIONS = Object.freeze({
  NORMAL: new Set(["AT_RISK"]),
  AT_RISK: new Set(["NORMAL", "AFFECTED"]),
  AFFECTED: new Set(["CONTINUITY_ACTIVE", "RECOVERING"]),
  CONTINUITY_ACTIVE: new Set(["RECOVERING"]),
  RECOVERING: new Set(["CONTINUITY_ACTIVE", "RECOVERED"]),
  RECOVERED: new Set(["NORMAL"]),
});

export function canTransition(from, to) {
  return TRANSITIONS[from]?.has(to) ?? false;
}

export function transitionExam(exam, to, details = {}) {
  const from = exam.state;
  if (!canTransition(from, to)) {
    const error = new Error(`Invalid exam state transition: ${from} -> ${to}`);
    error.status = 409;
    throw error;
  }

  exam.state = to;
  exam.stateVersion = (exam.stateVersion ?? 0) + 1;
  exam.stateChangedAt = new Date();
  if (details.reason) exam.stateReason = details.reason;
  return { from, to, version: exam.stateVersion, changedAt: exam.stateChangedAt };
}
