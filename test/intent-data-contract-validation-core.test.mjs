import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  intentAllowedValueMatchesType,
  validateIntentDataContract,
  validateIntentFieldBindings,
} from "../src/core/intent-data-contract-validation.mjs";

describe("Intent data contract validation core", () => {
  it("accepts absent and internally consistent contracts", () => {
    assert.deepEqual(validateIntentDataContract("request input", null), []);
    assert.deepEqual(validateIntentDataContract("request input", {
      fields: [
        { id: "name", type: "string", required: true, pattern: "^[a-z]+$" },
        { id: "count", type: "integer", minimum: 0, maximum: 10, allowedValues: ["0", "10"] },
        { id: "enabled", type: "boolean", allowedValues: ["true", "false"] },
      ],
      clauses: [{ ast: { op: "eq", args: ["count", "count"] } }],
    }), []);
  });

  it("reports field and Clause AST errors in deterministic order", () => {
    const errors = validateIntentDataContract("request input", {
      fields: [
        { id: "duplicate", type: "string" },
        { id: "duplicate", type: "string" },
        { id: "range", type: "string", minimum: 10, maximum: 5 },
        { id: "pattern", type: "boolean", pattern: "[" },
        { id: "integer", type: "integer", allowedValues: ["1", "bad", "bad"] },
        { id: "boolean", type: "boolean", allowedValues: ["true", "yes"] },
        { id: "identifier", type: "identifier", allowedValues: ["ok-id", "bad value"] },
      ],
      clauses: [{ ast: { op: "and", children: [] } }],
    });

    assert.deepEqual(errors, [
      "duplicate intent contract field id in request input: duplicate",
      "intent contract range requires integer field: request input.range",
      "intent contract minimum exceeds maximum: request input.range",
      "intent contract pattern requires string field: request input.pattern",
      "invalid intent contract pattern: request input.pattern",
      "duplicate intent contract allowed value in request input.integer: bad",
      "intent contract allowed value has wrong type: request input.integer -> bad",
      "intent contract allowed value has wrong type: request input.integer -> bad",
      "intent contract allowed value has wrong type: request input.boolean -> yes",
      "intent contract allowed value has wrong type: request input.identifier -> bad value",
      "invalid expr ast: request input clauses[0] and expects at least 1 child",
    ]);
  });

  it("validates required and unique refinement field bindings", () => {
    const errors = validateIntentFieldBindings(
      "request.handler input",
      {
        fields: [
          { id: "required" },
          { id: "optional", required: false },
          { id: "missing" },
        ],
      },
      [
        { contractField: "required", implementationField: "body.value" },
        { contractField: "required", implementationField: "body.value" },
        { contractField: "unknown", implementationField: "body.unknown" },
      ],
    );

    assert.deepEqual(errors, [
      "duplicate intent refinement contract field in request.handler input: required",
      "duplicate intent refinement implementation field in request.handler input: body.value",
      "unknown intent refinement contract field: request.handler input -> unknown",
      "intent refinement missing required field binding: request.handler input -> missing",
    ]);
  });

  it("checks allowed values according to their declared field type", () => {
    assert.equal(intentAllowedValueMatchesType({ type: "string" }, "anything"), true);
    assert.equal(intentAllowedValueMatchesType({ type: "integer" }, "-12"), true);
    assert.equal(intentAllowedValueMatchesType({ type: "integer" }, "1.2"), false);
    assert.equal(intentAllowedValueMatchesType({ type: "boolean" }, "false"), true);
    assert.equal(intentAllowedValueMatchesType({ type: "boolean" }, "False"), false);
    assert.equal(intentAllowedValueMatchesType({ type: "identifier" }, "order/item-1"), true);
    assert.equal(intentAllowedValueMatchesType({ type: "identifier" }, "order item"), false);
  });
});
