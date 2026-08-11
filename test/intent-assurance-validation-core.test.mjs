import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  intentAssuranceTasks,
  intentClaims,
  intentGoals,
  validateIntentGoalClaimAssurance,
} from "../src/core/intent-assurance-validation.mjs";

describe("Intent goal, claim, and assurance validation core", () => {
  it("accepts an internally consistent assurance graph", () => {
    assert.deepEqual(validateIntentGoalClaimAssurance(
      [{ id: "approve" }],
      [{ id: "approval-goal", intents: ["approve"], claims: ["approval-works"] }],
      [{ id: "approval-works", processes: ["approve"] }],
      [{
        id: "approval-test",
        claims: ["approval-works"],
        kind: "property-test",
        backend: "node",
        assurance: "executed",
        target: { kind: "test" },
      }],
    ), []);
  });

  it("reports goal and claim reference errors in deterministic order", () => {
    const errors = validateIntentGoalClaimAssurance(
      [{ id: "known" }, { id: "other" }],
      [
        { id: "empty", intents: [], claims: [] },
        { id: "main", intents: ["known"], claims: ["claim", "outside"] },
        { id: "second", intents: ["other"], claims: ["claim"] },
        {
          id: "invalid",
          intents: ["missing", "missing"],
          claims: ["missing-claim", "missing-claim"],
        },
      ],
      [
        { id: "claim", processes: ["known", "known"] },
        { id: "outside", processes: ["other"] },
        { id: "orphan", processes: [] },
      ],
      [{
        id: "all-claims-reviewed",
        claims: ["claim", "outside", "orphan"],
        kind: "manual-review",
        backend: "manual",
        assurance: "reference",
        target: { kind: "document" },
      }],
    );

    assert.deepEqual(errors, [
      "intent goal has no processes: empty",
      "intent goal has no claims: empty",
      "duplicate intent goal process in invalid: missing",
      "duplicate intent goal claim in invalid: missing-claim",
      "unknown intent goal process: invalid -> missing",
      "unknown intent goal process: invalid -> missing",
      "unknown intent goal claim: invalid -> missing-claim",
      "unknown intent goal claim: invalid -> missing-claim",
      "duplicate intent claim process in claim: known",
      "intent claim belongs to multiple goals: claim",
      "intent claim process is outside goal intent: claim -> known",
      "intent claim process is outside goal intent: claim -> known",
      "intent claim process is outside goal intent: outside -> other",
      "intent claim has no processes: orphan",
      "intent claim has no goal: orphan",
    ]);
  });

  it("validates assurance task contracts and claim coverage", () => {
    const claimIds = ["one", "two", "three", "four", "five", "six", "uncovered"];
    const errors = validateIntentGoalClaimAssurance(
      [{ id: "known" }],
      [{ id: "goal", intents: ["known"], claims: claimIds }],
      claimIds.map((id) => ({ id, processes: ["known"] })),
      [
        {
          id: "empty",
          claims: [],
          kind: "property-test",
          backend: "node",
          assurance: "executed",
          target: { kind: "test" },
        },
        {
          id: "unknown",
          claims: ["missing"],
          kind: "property-test",
          backend: "node",
          assurance: "executed",
          target: { kind: "test" },
        },
        {
          id: "property",
          claims: ["one", "one"],
          kind: "property-test",
          backend: "manual",
          assurance: "reference",
          target: { kind: "test" },
        },
        {
          id: "formal",
          claims: ["two"],
          kind: "formal-model",
          backend: "manual",
          assurance: "proved",
          target: { kind: "test" },
        },
        {
          id: "runtime",
          claims: ["three"],
          kind: "runtime-observation",
          backend: "node",
          assurance: "reference",
          target: { kind: "test" },
        },
        {
          id: "manual",
          claims: ["four"],
          kind: "manual-review",
          backend: "node",
          assurance: "executed",
          target: { kind: "document" },
        },
        {
          id: "lean",
          claims: ["five"],
          kind: "formal-model",
          backend: "lean",
          assurance: "proved",
          target: { kind: "proof" },
        },
        {
          id: "review",
          claims: ["six"],
          kind: "manual-review",
          backend: "manual",
          assurance: "reference",
          target: { kind: "document" },
        },
      ],
    );

    assert.deepEqual(errors, [
      "intent assurance task has no claims: empty",
      "unknown intent assurance task claim: unknown -> missing",
      "duplicate intent assurance task claim in property: one",
      "intent property-test task requires node or playwright backend: property",
      "intent property-test task requires executed or mutation-tested assurance: property",
      "intent formal-model task requires lean, alloy, or quint backend: formal",
      "intent formal-model task requires a model or proof target: formal",
      "intent formal-model task assurance mismatch: formal -> manual requires bounded",
      "intent runtime-observation task requires runtime executed evidence: runtime",
      "intent manual-review task requires manual reference assurance: manual",
      "intent claim has no assurance task: uncovered",
    ]);
  });

  it("exposes typed accessors for the shared Intent pattern", () => {
    const intent = {
      goals: [{ id: "goal" }],
      claims: [{ id: "claim" }],
      assuranceTasks: [{ id: "task" }],
    };
    assert.deepEqual(intentGoals(intent).map(({ id }) => id), ["goal"]);
    assert.deepEqual(intentClaims(intent).map(({ id }) => id), ["claim"]);
    assert.deepEqual(intentAssuranceTasks(intent).map(({ id }) => id), ["task"]);
  });
});
