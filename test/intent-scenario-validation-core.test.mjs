import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  intentScenarios,
  validateIntentScenarios,
} from "../src/core/intent-scenario-validation.mjs";

const vocabulary = [
  { id: "pending", kind: "state" },
  { id: "approved", kind: "state" },
  { id: "archived", kind: "state" },
  { id: "actor", kind: "actor" },
];

const processes = [
  { id: "approve", input: "pending", outcomes: ["approved-outcome"] },
  { id: "archive", input: "approved", outcomes: ["archived-outcome"] },
];

const outcomes = [
  { id: "approved-outcome", state: "approved" },
  { id: "archived-outcome", state: "archived" },
];

describe("Intent scenario validation core", () => {
  it("validates state references and rejects empty scenarios", () => {
    const errors = validateIntentScenarios(vocabulary, processes, outcomes, [
      {
        id: "empty",
        initialState: "missing-initial",
        expectedState: "actor",
        steps: [],
      },
    ]);

    assert.deepEqual(errors, [
      "unknown intent scenario initial state: empty -> missing-initial",
      "unknown intent scenario expected state: empty -> actor",
      "intent scenario has no steps: empty",
    ]);
  });

  it("reports missing references and discontinuous transitions deterministically", () => {
    const errors = validateIntentScenarios(vocabulary, processes, outcomes, [
      {
        id: "missing-step-references",
        initialState: "pending",
        expectedState: "approved",
        steps: [{ process: "missing-process", outcome: "missing-outcome" }],
      },
      {
        id: "discontinuous",
        initialState: "approved",
        expectedState: "archived",
        steps: [
          { process: "approve", outcome: "approved-outcome" },
          { process: "archive", outcome: "approved-outcome" },
        ],
      },
    ]);

    assert.deepEqual(errors, [
      "unknown intent scenario process: missing-step-references[0] -> missing-process",
      "unknown intent scenario outcome: missing-step-references[0] -> missing-outcome",
      "intent scenario expected state mismatch: missing-step-references expected approved, actual pending",
      "intent scenario input state mismatch: discontinuous[0] expected approved, process accepts pending",
      "intent scenario outcome is not declared by process: discontinuous[1] -> approved-outcome",
      "intent scenario expected state mismatch: discontinuous expected archived, actual approved",
    ]);
  });

  it("accepts a continuous scenario and exposes the typed accessor", () => {
    assert.deepEqual(validateIntentScenarios(vocabulary, processes, outcomes, [
      {
        id: "continuous",
        initialState: "pending",
        expectedState: "archived",
        steps: [
          { process: "approve", outcome: "approved-outcome" },
          { process: "archive", outcome: "archived-outcome" },
        ],
      },
    ]), []);
    assert.deepEqual(
      intentScenarios({ scenarios: [{ id: "scenario" }] }).map(({ id }) => id),
      ["scenario"],
    );
    assert.deepEqual(intentScenarios(null), []);
  });
});
