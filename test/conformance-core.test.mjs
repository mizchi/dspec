import assert from "node:assert/strict";
import test from "node:test";

import { conformanceReport } from "../src/core/conformance.mjs";

const atom = (name, ...args) => ({ op: "atom", name, args, children: [] });

const model = {
  id: "conformance-core",
  version: "0.1.0",
  clauseAstSemanticsVersion: "1.0",
  rules: [
    {
      id: "ACCESS-ALLOWED",
      must: [{ expr: "allowed(subject)", ast: atom("allowed", "subject") }],
      mustNot: [],
      when: [],
    },
  ],
  conformance: {
    targets: [
      {
        id: "access-adapter",
        rule: "ACCESS-ALLOWED",
        selector: "must[0]",
        implementation: { kind: "code", path: "fixtures/access.mjs", symbol: "isAllowed" },
        cases: [
          {
            id: "full-input",
            bindings: { subject: "alice" },
            atoms: [{ name: "allowed", args: ["alice"], value: true }],
            shrinksTo: "minimal-input",
          },
          {
            id: "minimal-input",
            bindings: { subject: "alice" },
            atoms: [{ name: "allowed", args: ["alice"], value: true }],
          },
          {
            id: "denied-input",
            bindings: { subject: "bob" },
            atoms: [{ name: "allowed", args: ["bob"], value: false }],
          },
        ],
      },
    ],
  },
};

test("reports agreement between Clause.ast reference semantics and an implementation adapter", async () => {
  const report = await conformanceReport(model, {
    invoke(_target, input) {
      return input.bindings.subject === "alice";
    },
  });

  assert.equal(report.status, "pass");
  assert.deepEqual(report.summary, { targets: 1, passed: 1, failed: 0, cases: 3, passedCases: 3, failedCases: 0 });
  assert.equal(report.targets[0].counterexample, null);
  assert.equal(report.targets[0].cases[2].expected, false);
});

test("returns the smallest declared failing input as a deterministic counterexample", async () => {
  const report = await conformanceReport(model, {
    invoke() {
      return false;
    },
  });

  assert.equal(report.status, "fail");
  assert.equal(report.targets[0].counterexample.caseId, "minimal-input");
  assert.deepEqual(report.targets[0].counterexample.input.bindings, { subject: "alice" });
  assert.equal(report.targets[0].counterexample.expected, true);
  assert.equal(report.targets[0].counterexample.actual, false);
});
