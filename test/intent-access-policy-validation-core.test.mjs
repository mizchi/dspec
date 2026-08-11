import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  intentAccessPolicies,
  validateIntentAccessPolicyPrecedence,
  validateIntentAccessPolicyReferences,
} from "../src/core/intent-access-policy-validation.mjs";

describe("Intent access policy validation core", () => {
  it("validates process, subject, and override-list references", () => {
    const errors = validateIntentAccessPolicyReferences(
      [{ id: "known-process" }],
      [
        { id: "known-actor", kind: "actor" },
        { id: "known-role", kind: "role" },
        { id: "known-state", kind: "state" },
      ],
      [
        {
          id: "bad-references",
          process: "missing-process",
          subject: "missing-subject",
          priority: 1,
          overrides: ["base", "base"],
        },
        {
          id: "bad-subject-kind",
          process: "known-process",
          subject: "known-state",
          priority: 2,
          overrides: [],
        },
        {
          id: "valid",
          process: "known-process",
          subject: "known-role",
          priority: 3,
          overrides: [],
        },
      ],
    );

    assert.deepEqual(errors, [
      "unknown intent access policy process: bad-references -> missing-process",
      "intent access policy subject must be an actor or role: bad-references -> missing-subject",
      "duplicate intent access policy override in bad-references: base",
      "intent access policy subject must be an actor or role: bad-subject-kind -> known-state",
    ]);
  });

  it("reports ambiguous and invalid override precedence deterministically", () => {
    const errors = validateIntentAccessPolicyPrecedence([
      { id: "first", process: "process", subject: "actor", priority: 1, overrides: [] },
      { id: "second", process: "process", subject: "actor", priority: 1, overrides: [] },
      {
        id: "self",
        process: "process",
        subject: "self-subject",
        priority: 2,
        overrides: ["self"],
      },
      {
        id: "unknown",
        process: "process",
        subject: "unknown-subject",
        priority: 3,
        overrides: ["missing"],
      },
      { id: "different-target", process: "other", subject: "different-subject", priority: 1, overrides: [] },
      {
        id: "different",
        process: "process",
        subject: "different-subject",
        priority: 2,
        overrides: ["different-target"],
      },
      { id: "high", process: "process", subject: "low-subject", priority: 3, overrides: [] },
      {
        id: "low",
        process: "process",
        subject: "low-subject",
        priority: 2,
        overrides: ["high"],
      },
    ]);

    assert.deepEqual(errors, [
      "ambiguous intent access policy precedence: process -> actor at priority 1",
      "intent access policy cannot override itself: self",
      "intent access policy override must have higher priority: self -> self",
      "unknown intent access policy override: unknown -> missing",
      "intent access policy override target differs in process or subject: different -> different-target",
      "intent access policy override must have higher priority: low -> high",
    ]);
  });

  it("exposes a typed accessor for the shared Intent pattern", () => {
    assert.deepEqual(
      intentAccessPolicies({ accessPolicies: [{ id: "policy" }] }).map(({ id }) => id),
      ["policy"],
    );
    assert.deepEqual(intentAccessPolicies(null), []);
  });
});
