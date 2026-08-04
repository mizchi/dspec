import assert from "node:assert/strict";
import test from "node:test";

import {
  COUNTEREXAMPLE_SCHEMA_VERSION,
  normalizeCounterexample,
} from "../src/core/counterexample.mjs";

test("normalizes temporal and implementation witnesses into one replayable envelope", () => {
  const temporal = normalizeCounterexample({
    source: { kind: "temporal", check: "purchase.eventually-empty" },
    path: [{ id: "purchase", input: { quantity: 0 } }],
    trace: [{ available: 1 }, { available: 1 }],
    violation: { index: 1, state: { available: 1 } },
  });
  const implementation = normalizeCounterexample({
    source: { kind: "implementation", check: "purchase-grounding" },
    path: [],
    action: { id: "purchase", input: { quantity: 1 } },
    state: { available: 1 },
    expected: { status: "accepted", state: { available: 0 } },
    actual: { status: "accepted", state: { available: 1 } },
  });

  assert.deepEqual(temporal, {
    schemaVersion: COUNTEREXAMPLE_SCHEMA_VERSION,
    source: { kind: "temporal", check: "purchase.eventually-empty", rule: null, formalization: null },
    path: [{ id: "purchase", input: { quantity: 0 } }],
    trace: [{ available: 1 }, { available: 1 }],
    expected: null,
    actual: null,
    violation: { index: 1, state: { available: 1 }, message: null },
  });
  assert.deepEqual(implementation, {
    schemaVersion: COUNTEREXAMPLE_SCHEMA_VERSION,
    source: { kind: "implementation", check: "purchase-grounding", rule: null, formalization: null },
    path: [{ id: "purchase", input: { quantity: 1 } }],
    trace: [{ available: 1 }, { available: 1 }],
    expected: { status: "accepted", state: { available: 0 } },
    actual: { status: "accepted", state: { available: 1 } },
    violation: { index: 1, state: { available: 1 }, message: null },
  });
});

test("keeps SAT, SMT, and Alloy witness provenance without backend-specific branching", () => {
  const kinds = ["sat", "smt", "alloy"];
  const normalized = kinds.map((kind) => normalizeCounterexample({
    source: { kind, check: `${kind}.witness` },
    trace: [{ candidate: kind }],
    violation: { index: 0, state: { candidate: kind } },
  }));

  assert.deepEqual(normalized.map((counterexample) => counterexample.source), [
    { kind: "sat", check: "sat.witness", rule: null, formalization: null },
    { kind: "smt", check: "smt.witness", rule: null, formalization: null },
    { kind: "alloy", check: "alloy.witness", rule: null, formalization: null },
  ]);
  assert.ok(normalized.every((counterexample) => counterexample.schemaVersion === COUNTEREXAMPLE_SCHEMA_VERSION));
});
