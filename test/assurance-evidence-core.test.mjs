import assert from "node:assert/strict";
import test from "node:test";

import { clauseBackendSupport } from "../src/core/assurance-evidence.mjs";

test("classifies the supported Lean equality fragment as semantic", () => {
  assert.equal(clauseBackendSupport("lean", ["eq"]), "semantic");
  assert.equal(clauseBackendSupport("lean", ["neq", "not"]), "semantic");
  assert.equal(clauseBackendSupport("lean", ["eq", "implies"]), "semantic");
  assert.equal(clauseBackendSupport("lean", ["atom"]), "structural");
  assert.equal(clauseBackendSupport("lean", ["eq", "and"]), "structural");
  assert.equal(clauseBackendSupport("lean", ["atom", "implies"]), "structural");
});
