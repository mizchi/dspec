import assert from "node:assert/strict";
import test from "node:test";

import {
  externalHoldoutCorpusReport,
  renderExternalHoldoutCorpusMarkdown,
} from "../src/core/external-holdouts.mjs";

test("aggregates external holdouts without filesystem or Pkl access", () => {
  const report = externalHoldoutCorpusReport({
    id: "external-contract",
    holdouts: [
      {
        holdout: {
          id: "passed-holdout",
          sourceRepository: "example/passed",
          sourceRevision: "abc123",
          manualMappings: [],
          exclusions: [],
        },
        authoredIntent: {
          evaluationPath: "passed.pkl",
          facts: [{ kind: "route", id: "GET /health" }],
        },
        observedImplementation: {
          appRoot: "passed-app",
          facts: [{ kind: "route", id: "GET /health" }],
        },
        evaluation: {
          status: "pass",
          summary: { expected: 1, observed: 1, matched: 1, missing: 0, unexpected: 0, precision: 1, recall: 1 },
          errors: [],
        },
      },
      {
        holdout: {
          id: "failed-holdout",
          sourceRepository: "example/failed",
          sourceRevision: "def456",
          manualMappings: [],
          exclusions: [],
        },
        authoredIntent: {
          evaluationPath: "failed.pkl",
          facts: [{ kind: "route", id: "GET /ready" }],
        },
        observedImplementation: {
          appRoot: "failed-app",
          facts: [],
        },
        evaluation: {
          status: "fail",
          summary: { expected: 1, observed: 0, matched: 0, missing: 1, unexpected: 0, precision: 1, recall: 0 },
          errors: ["missing expected fact: route:GET /ready"],
        },
      },
    ],
    mutations: [
      {
        id: "mutation-contract",
        sourceRepository: "example/mutation",
        sourceBeforeRevision: "before",
        sourceAfterRevision: "after",
        beforeAppRoot: "before-app",
        afterAppRoot: "after-app",
        added: [{ kind: "workflow", id: "release" }],
        removed: [],
        expectedAdded: [{ kind: "workflow", id: "release" }],
        expectedRemoved: [],
        status: "pass",
        errors: [],
      },
    ],
  });

  assert.equal(report.status, "fail");
  assert.deepEqual(report.summary, {
    holdouts: {
      total: 2,
      passed: 1,
      expected: 2,
      observed: 1,
      matched: 1,
      missing: 1,
      unexpected: 0,
      estimatedAuthoringMinutes: 0,
      manualMappings: 0,
      exclusions: 0,
      precision: 1,
      recall: 0.5,
    },
    mutations: {
      total: 1,
      detected: 1,
      added: 1,
      removed: 0,
      missed: 0,
      detectionRate: 1,
    },
  });
  assert.deepEqual(report.errors, ["failed-holdout: missing expected fact: route:GET /ready"]);
  assert.match(renderExternalHoldoutCorpusMarkdown(report), /failed-holdout/);
  assert.match(renderExternalHoldoutCorpusMarkdown(report), /mutation-contract/);
});
