import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createIntentRefinementValidationState,
  intentRefinements,
  validateIntentRefinements,
} from "../src/core/intent-refinement-validation.mjs";

describe("Intent refinement validation core", () => {
  it("validates endpoint kinds, DB references, and cross-process IDs in order", () => {
    const state = createIntentRefinementValidationState();
    const firstErrors = validateIntentRefinements(
      {
        id: "first-process",
        outcomes: [],
        refinements: [
          {
            id: "shared-refinement",
            kind: "http-route",
            grpc: { method: "/Service/Method" },
          },
          {
            id: "transaction-with-wrong-kind",
            kind: "function",
            transaction: { dbTransaction: "missing-transaction" },
          },
        ],
      },
      [],
      [{ id: "known-transaction" }],
      state,
    );
    const secondErrors = validateIntentRefinements(
      {
        id: "second-process",
        outcomes: [],
        refinements: [{
          id: "shared-refinement",
          kind: "grpc-method",
          http: { method: "POST", path: "/requests" },
        }],
      },
      [],
      [{ id: "known-transaction" }],
      state,
    );

    assert.deepEqual(firstErrors, [
      "intent HTTP refinement requires endpoint: first-process.shared-refinement",
      "intent refinement gRPC endpoint requires grpc-method kind: first-process.shared-refinement",
      "intent refinement transaction endpoint requires transaction kind: first-process.transaction-with-wrong-kind",
      "unknown intent transaction refinement DB transaction: first-process.transaction-with-wrong-kind -> missing-transaction",
    ]);
    assert.deepEqual(secondErrors, [
      "duplicate intent refinement id: shared-refinement",
      "intent refinement HTTP endpoint requires http-route kind: second-process.shared-refinement",
      "intent gRPC refinement requires endpoint: second-process.shared-refinement",
    ]);
  });

  it("validates nested input, outcome, and effect field bindings", () => {
    const errors = validateIntentRefinements(
      {
        id: "process",
        inputContract: {
          fields: [{ id: "input-id", type: "identifier" }],
        },
        outcomes: ["first-outcome", "second-outcome"],
        refinements: [{
          id: "refinement",
          kind: "function",
          inputBindings: [],
          outcomeBindings: [
            { outcome: "missing-outcome" },
            {
              outcome: "first-outcome",
              fields: [
                { contractField: "missing-field", implementationField: "same" },
                { contractField: "result", implementationField: "same" },
              ],
              effectBindings: [
                { effect: "missing-effect" },
                { effect: "required-effect", fields: [] },
              ],
            },
          ],
        }],
      },
      [
        {
          id: "first-outcome",
          outputContract: { fields: [{ id: "result", type: "identifier" }] },
          effects: [
            {
              id: "required-effect",
              outputContract: { fields: [{ id: "event-id", type: "identifier" }] },
            },
            {
              id: "optional-effect",
              outputContract: {
                fields: [{ id: "optional", type: "string", required: false }],
              },
            },
          ],
        },
        {
          id: "second-outcome",
          outputContract: { fields: [{ id: "other", type: "string" }] },
          effects: [],
        },
      ],
      [],
      createIntentRefinementValidationState(),
    );

    assert.deepEqual(errors, [
      "intent refinement missing required field binding: process.refinement input -> input-id",
      "unknown intent refinement outcome: process.refinement -> missing-outcome",
      "duplicate intent refinement implementation field in process.refinement outcome first-outcome: same",
      "unknown intent refinement contract field: process.refinement outcome first-outcome -> missing-field",
      "unknown intent refinement outcome effect: process.refinement.first-outcome -> missing-effect",
      "intent refinement missing required field binding: process.refinement outcome first-outcome effect required-effect -> event-id",
      "intent refinement missing outcome binding: process.refinement -> second-outcome",
    ]);
  });

  it("reports duplicate nested bindings and exposes the typed accessor", () => {
    const errors = validateIntentRefinements(
      {
        id: "process",
        outcomes: ["outcome"],
        refinements: [{
          id: "refinement",
          kind: "function",
          outcomeBindings: [
            { outcome: "outcome", effectBindings: [{ effect: "effect" }, { effect: "effect" }] },
            { outcome: "outcome", effectBindings: [] },
          ],
        }],
      },
      [{ id: "outcome", effects: [{ id: "effect" }] }],
      [],
      createIntentRefinementValidationState(),
    );

    assert.deepEqual(errors, [
      "duplicate intent refinement outcome binding in process.refinement: outcome",
      "duplicate intent refinement effect binding in process.refinement outcome outcome: effect",
    ]);
    assert.deepEqual(
      intentRefinements({ refinements: [{ id: "refinement" }] }).map(({ id }) => id),
      ["refinement"],
    );
    assert.deepEqual(intentRefinements(null), []);
  });
});
