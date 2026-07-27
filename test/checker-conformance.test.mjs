import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const suite = JSON.parse(readFileSync("fixtures/checker-conformance-suite.json", "utf8"));

test("declares stable checker conformance cases", () => {
  assert.equal(suite.contractVersion, "dspec-checker-conformance-v1");
  assert.deepEqual(suite.cases.map((entry) => entry.id), [
    "check-self-model",
    "drift-self-model",
    "coverage-self-model",
    "implementation-conformance",
    "localized-spec-query",
    "external-real-app-holdouts",
  ]);
  for (const entry of suite.cases) {
    assert.equal(entry.argv.includes("--json"), true);
    assert.match(entry.expectedReport, /^fixtures\/reports\/.+\.json$/);
  }
});
