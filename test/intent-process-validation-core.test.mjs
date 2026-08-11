import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  intentProcesses,
  validateIntentProcess,
} from "../src/core/intent-process-validation.mjs";

const vocabulary = [
  { id: "input-state", kind: "state" },
  { id: "outcome-state", kind: "state" },
  { id: "other-state", kind: "state" },
  { id: "actor", kind: "actor" },
];

const capabilities = [
  { id: "required-capability" },
  { id: "effect-capability" },
];

const outcomes = [
  {
    id: "known-outcome",
    state: "outcome-state",
    effects: [{ id: "known-effect", capability: "effect-capability" }],
  },
  { id: "other-outcome", state: "other-state", effects: [] },
];

function validProcess(overrides = {}) {
  return {
    id: "process",
    input: "input-state",
    outcomes: ["known-outcome"],
    constructs: ["known-outcome"],
    requires: ["required-capability"],
    effects: ["effect-capability"],
    transitions: [{ from: "input-state", to: "outcome-state" }],
    ...overrides,
  };
}

describe("Intent process validation core", () => {
  it("validates the input contract and bounded execution policy", () => {
    assert.deepEqual(validateIntentProcess(
      validProcess({
        inputContract: {
          fields: [{ id: "request-id", type: "identifier" }, {
            id: "range",
            type: "integer",
            minimum: 2,
            maximum: 1,
          }],
        },
        execution: {
          maxInFlight: 0,
          timeoutSteps: 0,
          timeoutMs: 0,
          idempotencyKey: "missing-key",
        },
      }),
      vocabulary,
      capabilities,
      outcomes,
    ), [
      "intent contract minimum exceeds maximum: process input.range",
      "intent execution maxInFlight must be a positive integer: process",
      "intent execution timeoutSteps must be a positive integer: process",
      "intent execution timeoutMs must be a positive integer: process",
      "intent execution idempotency key is not an input field: process -> missing-key",
    ]);

    assert.deepEqual(validateIntentProcess(
      validProcess({
        inputContract: { fields: [{ id: "request-id", type: "identifier", required: false }] },
        execution: { maxInFlight: 1, idempotencyKey: "request-id" },
      }),
      vocabulary,
      capabilities,
      outcomes,
    ), ["intent execution idempotency key must be required: process -> request-id"]);

    assert.deepEqual(validateIntentProcess(
      validProcess({
        inputContract: { fields: [{ id: "request-id", type: "integer" }] },
        execution: { maxInFlight: 1, idempotencyKey: "request-id" },
      }),
      vocabulary,
      capabilities,
      outcomes,
    ), ["intent execution idempotency key must have identifier or string type: process -> request-id"]);
  });

  it("validates outcome construction and capability references deterministically", () => {
    const errors = validateIntentProcess(
      validProcess({
        input: "missing-input",
        outcomes: ["missing-outcome", "known-outcome", "known-outcome"],
        constructs: ["missing-constructed", "other-outcome", "other-outcome"],
        requires: ["missing-required", "missing-required"],
        effects: ["missing-effect"],
      }),
      vocabulary,
      capabilities,
      outcomes,
    );

    assert.deepEqual(errors, [
      "unknown intent process input state: process -> missing-input",
      "duplicate intent process outcome in process: known-outcome",
      "duplicate intent process construct in process: other-outcome",
      "duplicate intent process required capability in process: missing-required",
      "unknown intent process outcome: process -> missing-outcome",
      "unknown intent process constructed outcome: process -> missing-constructed",
      "intent process constructs undeclared outcome: process -> other-outcome",
      "intent process constructs undeclared outcome: process -> other-outcome",
      "intent process outcome has no construction path: process -> missing-outcome",
      "intent process outcome has no construction path: process -> known-outcome",
      "intent process outcome has no construction path: process -> known-outcome",
      "unknown intent process required capability: process -> missing-required",
      "unknown intent process required capability: process -> missing-required",
      "unknown intent process effect capability: process -> missing-effect",
      "intent process effect capability is not declared for outcome effect: process.known-outcome.known-effect -> effect-capability",
      "intent process effect capability is not declared for outcome effect: process.known-outcome.known-effect -> effect-capability",
      "intent process transition source differs from input: process -> input-state",
    ]);
  });

  it("validates transition continuity and exposes the typed accessor", () => {
    assert.deepEqual(validateIntentProcess(
      validProcess({ transitions: [{ from: "actor", to: "actor" }] }),
      vocabulary,
      capabilities,
      outcomes,
    ), [
      "unknown intent process transition source state: process -> actor",
      "unknown intent process transition target state: process -> actor",
      "intent process transition source differs from input: process -> actor",
      "intent process transition target is not an outcome: process -> actor",
      "intent process outcome has no transition: process -> known-outcome",
    ]);
    assert.deepEqual(validateIntentProcess(
      validProcess(),
      vocabulary,
      capabilities,
      outcomes,
    ), []);
    assert.deepEqual(
      intentProcesses({ processes: [{ id: "process" }] }).map(({ id }) => id),
      ["process"],
    );
    assert.deepEqual(intentProcesses(null), []);
  });
});
