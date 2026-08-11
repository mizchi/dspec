export const TRACE_LOCK_SCHEMA_VERSION: "1.0";

export type TraceModelIdentity = {
  id: string | null;
  version: string | null;
};

export type TraceReference = {
  key: string;
  contentHash: string;
  hashScope: string;
};

export type TraceRuleSnapshot = {
  id: string;
  contentHash: string;
  implementations: TraceReference[];
  tests: TraceReference[];
  checks: TraceReference[];
};

export type TraceCoverage = {
  id: string;
  status: "verified" | "impl-only" | "test-only" | "uncovered";
  implementations: number;
  tests: number;
  checks: number;
};

export type TraceSnapshot = {
  traceSchemaVersion: string;
  status: "pass" | "fail";
  model: TraceModelIdentity;
  rules: TraceRuleSnapshot[];
  coverage: TraceCoverage[];
  errors: string[];
};

export type TraceLock = {
  traceLockSchemaVersion: string;
  model: TraceModelIdentity;
  rules: TraceRuleSnapshot[];
};

export type TraceDrift = {
  kind: string;
  rule: string;
  category?: string;
  key: string;
};

export type TraceCheckReport = {
  traceSchemaVersion: string;
  status: "pass" | "fail";
  model: TraceModelIdentity;
  drift: TraceDrift[];
  coverage: TraceCoverage[];
  errors: string[];
};

export function traceSnapshot(
  document: unknown,
  options?: { projectRoot?: string },
): TraceSnapshot;
export function createTraceLock(snapshot: TraceSnapshot): TraceLock;
export function traceCheck(
  document: unknown,
  lock: unknown,
  options?: { projectRoot?: string },
): TraceCheckReport;
