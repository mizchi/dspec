/** A backend-neutral, replayable witness shape for bounded verification. */
export const COUNTEREXAMPLE_SCHEMA_VERSION = "1.0";

function list(value) {
  return Array.isArray(value) ? value : [];
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function actionStep(value) {
  const step = record(value) ?? {};
  return {
    id: String(step.id ?? step.action ?? "unknown"),
    input: record(step.input) ?? {},
  };
}

/**
 * Normalize a bounded witness without altering the solver's raw evidence.
 * Callers retain the raw witness separately; this envelope is the portable
 * representation for traceability reports, replay adapters, and documents.
 */
export function normalizeCounterexample(value) {
  const input = record(value) ?? {};
  const source = record(input.source) ?? {};
  const path = list(input.path).map(actionStep);
  if (input.action) path.push(actionStep(input.action));
  const state = record(input.state);
  const actualState = record(input.actual)?.state ?? null;
  const trace = list(input.trace);
  if (trace.length === 0 && state) {
    trace.push(state);
    if (actualState) trace.push(actualState);
  }
  const violation = record(input.violation);
  return {
    schemaVersion: COUNTEREXAMPLE_SCHEMA_VERSION,
    source: {
      kind: String(source.kind ?? "unknown"),
      check: source.check ?? null,
      rule: source.rule ?? null,
      formalization: source.formalization ?? null,
    },
    path,
    trace,
    expected: input.expected ?? null,
    actual: input.actual ?? null,
    violation: {
      index: violation?.index ?? Math.max(0, trace.length - 1),
      state: violation?.state ?? trace.at(-1) ?? null,
      message: violation?.message ?? input.error ?? null,
    },
  };
}
