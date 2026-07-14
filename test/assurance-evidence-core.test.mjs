import assert from "node:assert/strict";
import test from "node:test";

import { clauseBackendSupport } from "../src/core/assurance-evidence.mjs";

test("classifies only standalone Lean eq clauses as semantic", () => {
  assert.equal(clauseBackendSupport("lean", ["eq"]), "semantic");
  assert.equal(clauseBackendSupport("lean", ["atom"]), "structural");
  assert.equal(clauseBackendSupport("lean", ["eq", "not"]), "structural");
});
