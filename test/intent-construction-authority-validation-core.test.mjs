import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  intentConstructionAuthorities,
  validateIntentConstructionAuthorities,
} from "../src/core/intent-construction-authority-validation.mjs";

describe("Intent construction authority validation core", () => {
  it("validates authority references, declarations, uniqueness, and total coverage", () => {
    const errors = validateIntentConstructionAuthorities(
      [
        { id: "first-process", constructs: ["first-outcome", "uncovered-outcome"] },
        { id: "second-process", constructs: ["misassigned-outcome"] },
      ],
      [
        { id: "first-outcome" },
        { id: "uncovered-outcome" },
        { id: "misassigned-outcome" },
        { id: "orphan-outcome" },
      ],
      [
        { id: "missing", process: "missing-process", outcome: "missing-outcome" },
        { id: "missing-duplicate", process: "missing-process", outcome: "missing-outcome" },
        { id: "misassigned", process: "first-process", outcome: "misassigned-outcome" },
        { id: "valid", process: "first-process", outcome: "first-outcome" },
        { id: "valid-duplicate", process: "first-process", outcome: "first-outcome" },
      ],
    );

    assert.deepEqual(errors, [
      "unknown construction authority process: missing -> missing-process",
      "unknown construction authority outcome: missing -> missing-outcome",
      "unknown construction authority process: missing-duplicate -> missing-process",
      "unknown construction authority outcome: missing-duplicate -> missing-outcome",
      "duplicate construction authority: missing-process -> missing-outcome",
      "construction authority is not declared by process: misassigned -> misassigned-outcome",
      "duplicate construction authority: first-process -> first-outcome",
      "intent process construction has no authority: first-process -> uncovered-outcome",
      "intent process construction has no authority: second-process -> misassigned-outcome",
      "intent outcome has no construction authority: uncovered-outcome",
      "intent outcome has no construction authority: orphan-outcome",
    ]);
  });

  it("accepts a closed construction graph and exposes the typed accessor", () => {
    assert.deepEqual(validateIntentConstructionAuthorities(
      [{ id: "process", constructs: ["outcome"] }],
      [{ id: "outcome" }],
      [{ id: "authority", process: "process", outcome: "outcome" }],
    ), []);
    assert.deepEqual(
      intentConstructionAuthorities({ constructionAuthorities: [{ id: "authority" }] })
        .map(({ id }) => id),
      ["authority"],
    );
    assert.deepEqual(intentConstructionAuthorities(null), []);
  });
});
