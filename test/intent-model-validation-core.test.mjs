import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  intentPattern,
  validateIntentCatalogUniqueness,
  validateIntentModel,
} from "../src/core/intent-model-validation.mjs";

describe("Intent model validation core", () => {
  it("reports catalog ID duplicates in the public contract order", () => {
    const duplicate = [{ id: "duplicate" }, { id: "duplicate" }];

    assert.deepEqual(validateIntentCatalogUniqueness({
      capabilities: duplicate,
      outcomes: duplicate,
      processes: duplicate,
      constructionAuthorities: duplicate,
      accessPolicies: duplicate,
      goals: duplicate,
      claims: duplicate,
      assuranceTasks: duplicate,
      semanticBindings: duplicate,
      scenarios: duplicate,
    }), [
      "duplicate intent capability id: duplicate",
      "duplicate intent outcome id: duplicate",
      "duplicate intent process id: duplicate",
      "duplicate construction authority id: duplicate",
      "duplicate intent access policy id: duplicate",
      "duplicate intent goal id: duplicate",
      "duplicate intent claim id: duplicate",
      "duplicate intent assurance task id: duplicate",
      "duplicate intent semantic binding id: duplicate",
      "duplicate intent scenario id: duplicate",
    ]);
  });

  it("orchestrates outcome, process, and authority diagnostics deterministically", () => {
    assert.deepEqual(validateIntentModel({
      vocabulary: [{ id: "known-state", kind: "state" }],
      patterns: {
        intent: {
          outcomes: [{ id: "outcome", state: "missing-state" }],
          processes: [{
            id: "process",
            input: "missing-input",
            outcomes: [],
            constructs: [],
            refinements: [],
          }],
        },
      },
    }), [
      "unknown intent outcome state: outcome -> missing-state",
      "unknown intent process input state: process -> missing-input",
      "intent process has no outcomes: process",
      "intent outcome has no construction authority: outcome",
    ]);
  });

  it("accepts an absent or empty Intent pattern and exposes its accessor", () => {
    assert.deepEqual(validateIntentModel({ patterns: {} }), []);
    assert.deepEqual(validateIntentModel({ patterns: { intent: {} } }), []);
    assert.deepEqual(intentPattern({ patterns: { intent: { processes: [] } } }), { processes: [] });
    assert.equal(intentPattern(null), null);
  });
});
