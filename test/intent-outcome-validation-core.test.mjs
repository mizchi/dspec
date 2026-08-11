import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  intentCapabilities,
  intentOutcomes,
  validateIntentOutcomes,
} from "../src/core/intent-outcome-validation.mjs";

describe("Intent outcome validation core", () => {
  it("validates states, effect capabilities, and nested data contracts in order", () => {
    const errors = validateIntentOutcomes(
      [
        { id: "known-state", kind: "state" },
        { id: "actor", kind: "actor" },
      ],
      [{ id: "known-capability" }],
      [
        {
          id: "bad-outcome",
          state: "missing-state",
          outputContract: {
            fields: [{ id: "range", type: "integer", minimum: 2, maximum: 1 }],
          },
          effects: [
            {
              id: "duplicate-effect",
              capability: "missing-capability",
              outputContract: {
                fields: [{ id: "pattern", type: "integer", pattern: "[" }],
              },
            },
            { id: "duplicate-effect", capability: "known-capability" },
          ],
        },
        { id: "known-outcome", state: "known-state", effects: [] },
        { id: "duplicate-state-outcome", state: "known-state", effects: [] },
      ],
    );

    assert.deepEqual(errors, [
      "unknown intent outcome state: bad-outcome -> missing-state",
      "intent contract minimum exceeds maximum: bad-outcome output.range",
      "duplicate intent outcome effect id in bad-outcome: duplicate-effect",
      "unknown intent outcome effect capability: bad-outcome.duplicate-effect -> missing-capability",
      "intent contract pattern requires string field: bad-outcome effect duplicate-effect output.pattern",
      "invalid intent contract pattern: bad-outcome effect duplicate-effect output.pattern",
      "duplicate intent outcome state: known-state",
    ]);
  });

  it("accepts a valid outcome and exposes typed Intent accessors", () => {
    assert.deepEqual(validateIntentOutcomes(
      [{ id: "state", kind: "state" }],
      [{ id: "capability" }],
      [{
        id: "outcome",
        state: "state",
        effects: [{ id: "effect", capability: "capability" }],
      }],
    ), []);
    assert.deepEqual(
      intentCapabilities({ capabilities: [{ id: "capability" }] }).map(({ id }) => id),
      ["capability"],
    );
    assert.deepEqual(
      intentOutcomes({ outcomes: [{ id: "outcome" }] }).map(({ id }) => id),
      ["outcome"],
    );
    assert.deepEqual(intentCapabilities(null), []);
    assert.deepEqual(intentOutcomes(null), []);
  });
});
