import assert from "node:assert/strict";
import test from "node:test";

import { evaluatePklJson } from "../src/adapters/pkl.mjs";

test("evaluates a typed Pkl document through the reusable adapter", () => {
  const document = evaluatePklJson("fixtures/typed-ast.pkl");

  assert.equal(document.model.id, "typed-ast-fixture");
  assert.equal(document.model.rules[0].must[0].ast.op, "atom");
});

test("selects the nearest PklProject for dependency-notation imports", () => {
  const document = evaluatePklJson("fixtures/pkl-package-consumer/consumer.pkl");

  assert.equal(document.model.id, "pkl-package-consumer");
});
