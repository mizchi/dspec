import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  intentSemanticBindings,
  validateIntentSemanticBindings,
} from "../src/core/intent-semantic-binding-validation.mjs";

const processes = [
  {
    id: "known-process",
    refinements: [
      {
        id: "http-refinement",
        kind: "http-route",
        http: { method: "POST", path: "/requests/approve" },
      },
      {
        id: "transaction-refinement",
        kind: "transaction",
        transaction: { dbTransaction: "approve-request" },
      },
    ],
  },
  { id: "other-process", refinements: [] },
];

describe("Intent semantic binding validation core", () => {
  it("validates claim, process, refinement, and implementation coverage references", () => {
    const errors = validateIntentSemanticBindings(
      processes,
      [
        { id: "known-claim", processes: ["known-process"] },
        { id: "other-claim", processes: ["other-process"] },
        { id: "uncovered-claim", processes: ["known-process"] },
        {
          id: "optional-claim",
          processes: ["known-process"],
          requiredImplementationBinding: false,
        },
      ],
      [{ id: "known-cloud-node" }],
      [
        {
          id: "bad-claims",
          claims: ["missing-claim", "other-claim", "other-claim"],
          process: "missing-process",
          kind: "otel-attribute",
          target: "dspec.intent.process",
          value: "missing-process",
        },
        {
          id: "bad-refinement",
          claims: ["known-claim"],
          process: "known-process",
          refinement: "missing-refinement",
          kind: "otel-attribute",
          target: "dspec.intent.process",
          value: "known-process",
        },
      ],
    );

    assert.deepEqual(errors, [
      "duplicate intent semantic binding claim in bad-claims: other-claim",
      "unknown intent semantic binding claim: bad-claims -> missing-claim",
      "intent semantic binding process is outside claim: bad-claims -> other-claim",
      "intent semantic binding process is outside claim: bad-claims -> other-claim",
      "unknown intent semantic binding process: bad-claims -> missing-process",
      "unknown intent semantic binding refinement: bad-refinement -> missing-refinement",
      "intent claim has no implementation binding: uncovered-claim",
    ]);
  });

  it("validates kind-specific targets and duplicate binding semantics deterministically", () => {
    const errors = validateIntentSemanticBindings(
      processes,
      [],
      [{ id: "known-cloud-node" }],
      [
        {
          id: "http-missing-refinement",
          process: "known-process",
          kind: "http-route",
          target: "POST /requests/approve",
        },
        {
          id: "http-target-mismatch",
          process: "known-process",
          refinement: "http-refinement",
          kind: "http-route",
          target: "GET /requests/approve",
        },
        {
          id: "db-wrong-refinement",
          process: "known-process",
          refinement: "http-refinement",
          kind: "db-transaction",
          target: "approve-request",
        },
        {
          id: "db-target-mismatch",
          process: "known-process",
          refinement: "transaction-refinement",
          kind: "db-transaction",
          target: "wrong-transaction",
        },
        {
          id: "unknown-cloud",
          process: "known-process",
          kind: "cloud-resource",
          target: "missing-cloud-node",
        },
        {
          id: "empty-otel",
          process: "known-process",
          kind: "otel-attribute",
          target: "dspec.intent.process",
          value: "",
        },
        {
          id: "duplicate-empty-otel",
          process: "known-process",
          kind: "otel-attribute",
          target: "dspec.intent.process",
          value: "",
        },
      ],
    );

    assert.deepEqual(errors, [
      "intent semantic HTTP binding requires an HTTP refinement: http-missing-refinement",
      "intent semantic HTTP binding target mismatch: http-target-mismatch expected POST /requests/approve, got GET /requests/approve",
      "intent semantic DB binding requires a transaction refinement: db-wrong-refinement",
      "intent semantic DB binding target mismatch: db-target-mismatch expected approve-request, got wrong-transaction",
      "unknown intent semantic cloud resource: unknown-cloud -> missing-cloud-node",
      "intent semantic OTel attribute requires a value: empty-otel",
      "duplicate intent semantic binding target: otel-attribute dspec.intent.process",
      "intent semantic OTel attribute requires a value: duplicate-empty-otel",
    ]);
  });

  it("exposes a typed accessor for the shared Intent pattern", () => {
    assert.deepEqual(
      intentSemanticBindings({ semanticBindings: [{ id: "binding" }] }).map(({ id }) => id),
      ["binding"],
    );
    assert.deepEqual(intentSemanticBindings(null), []);
  });
});
