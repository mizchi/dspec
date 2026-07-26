import assert from "node:assert/strict";
import test from "node:test";

import {
  domainTraceabilityReport,
  renderDomainTraceabilityMarkdown,
} from "../src/core/traceability.mjs";

function model() {
  return {
    id: "traceability-fixture",
    version: "0.1.0",
    primaryLocale: "ja",
    rules: [
      {
        id: "RULE-ADVANCE",
        text: { default: "進める操作は一段だけ進む", labels: { ja: "進める操作は一段だけ進む" } },
      },
      {
        id: "RULE-STOP",
        text: { default: "停止後には進めない", labels: { ja: "停止後には進めない" } },
      },
      {
        id: "RULE-OUT-OF-SCOPE",
        kind: "non_goal",
        text: { default: "今回は扱わない", labels: { ja: "今回は扱わない" } },
      },
    ],
    patterns: {
      domain: {
        commands: [{ id: "advance" }],
        events: [{ id: "advanced" }],
        formalizations: [{
          id: "advance-behavior",
          rule: "RULE-ADVANCE",
          kind: "behavior",
          assurance: "bounded",
          target: { kind: "model", path: "fixtures/advance.pkl" },
          assumptions: ["The model uses a single bounded counter."],
          actionMappings: [{ action: "advance", command: "advance", events: ["advanced"] }],
          checks: ["advance.one-step.holds"],
        }],
      },
    },
  };
}

test("reports bidirectional links and explicit traceability gaps", () => {
  const report = domainTraceabilityReport(model(), [{
    formalization: "advance-behavior",
    status: "pass",
    actions: ["advance"],
    checks: [{ id: "advance.one-step.holds", status: "pass", assurance: "bounded" }],
    counterexamples: [],
  }]);

  assert.equal(report.status, "attention");
  assert.deepEqual(report.summary, {
    formalizations: 1,
    passedFormalizations: 1,
    refinements: 0,
    passedRefinements: 0,
    rules: 2,
    excludedRules: 1,
    coveredRules: 1,
    commands: 1,
    coveredCommands: 1,
    events: 1,
    coveredEvents: 1,
    anomalies: 1,
  });
  assert.deepEqual(report.anomalies, [{
    kind: "uncovered-rule",
    id: "RULE-STOP",
    message: "rule has no declared formalization: RULE-STOP",
  }]);
  assert.deepEqual(report.formalizations[0].mappings, [{
    action: "advance",
    command: "advance",
    events: ["advanced"],
    status: "grounded",
  }]);
});

test("renders a failed formalization counterexample in domain language", () => {
  const report = domainTraceabilityReport(model(), [{
    formalization: "advance-behavior",
    status: "fail",
    actions: ["advance"],
    checks: [{
      id: "advance.one-step.holds",
      status: "fail",
      assurance: "bounded-all-paths",
      counterexample: {
        path: [{ id: "advance", input: {} }],
        trace: [{ count: 0 }, { count: 2 }],
        violation: { index: 1, state: { count: 2 } },
      },
    }],
    counterexamples: [],
  }]);

  const markdown = renderDomainTraceabilityMarkdown(report, { locale: "ja" });

  assert.equal(report.status, "fail");
  assert.match(markdown, /進める操作は一段だけ進む/);
  assert.match(markdown, /advance → command: advance → event: advanced/);
  assert.match(markdown, /状態 1: count=2/);
  assert.match(markdown, /違反位置: 1/);
});

test("requires a declared concrete check to substantiate an abstraction refinement", () => {
  const refinementModel = model();
  refinementModel.patterns.domain.formalizations.push({
    id: "advance-coordinate-alloy",
    rule: "RULE-ADVANCE",
    kind: "alloy-behavior",
    assurance: "bounded",
    target: { kind: "model", path: "fixtures/advance-coordinate.pkl" },
    checks: ["advance.coordinate.refines-input.holds"],
  });
  refinementModel.patterns.domain.refinements = [{
    id: "advance-input-from-coordinate",
    kind: "input-abstraction",
    sourceFormalization: "advance-behavior",
    targetFormalization: "advance-coordinate-alloy",
    sourceCondition: "advance-input = 1",
    targetCondition: "the coordinate step is available",
    checks: ["advance.coordinate.refines-input.holds"],
  }];

  const report = domainTraceabilityReport(refinementModel, [{
    formalization: "advance-behavior",
    status: "pass",
    actions: ["advance"],
    checks: [{ id: "advance.one-step.holds", status: "pass", assurance: "bounded" }],
    counterexamples: [],
  }, {
    formalization: "advance-coordinate-alloy",
    status: "pass",
    actions: [],
    checks: [{ id: "advance.coordinate.refines-input.holds", status: "pass", assurance: "alloy6-bounded" }],
    counterexamples: [],
  }]);

  assert.equal(report.status, "attention");
  assert.equal(report.summary.refinements, 1);
  assert.equal(report.summary.passedRefinements, 1);
  assert.deepEqual(report.refinements, [{
    id: "advance-input-from-coordinate",
    kind: "input-abstraction",
    sourceFormalization: "advance-behavior",
    targetFormalization: "advance-coordinate-alloy",
    sourceCondition: "advance-input = 1",
    targetCondition: "the coordinate step is available",
    assumptions: [],
    checks: [{ id: "advance.coordinate.refines-input.holds", status: "pass", assurance: "alloy6-bounded" }],
    status: "pass",
  }]);
  const markdown = renderDomainTraceabilityMarkdown(report, { locale: "ja" });
  assert.match(markdown, /## Refinements/);
  assert.match(markdown, /advance-input-from-coordinate/);
  assert.match(markdown, /advance-input = 1/);
});
