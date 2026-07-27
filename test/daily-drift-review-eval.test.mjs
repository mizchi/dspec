import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(root, "scripts", "evaluate-daily-drift-review.mjs");
const suite = "fixtures/daily-drift-review-eval-suite.json";
const answers = "fixtures/daily-drift-review-eval-answers.json";

function run(args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

test("scores required drift findings, evidence paths, and no-drift restraint", () => {
  const result = run(["--json", suite, answers]);

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "pass");
  assert.equal(report.summary.total, 4);
  assert.ok(report.cases.every((entry) => entry.status === "pass"));
});

test("rejects a hallucinated finding in a no-drift review", () => {
  const output = mkdtempSync(join(tmpdir(), "dspec-daily-drift-eval-"));
  const mutatedAnswers = join(output, "answers.json");
  try {
    const document = JSON.parse(readFileSync(join(root, answers), "utf8"));
    document.answers.find((answer) => answer.caseId === "no-drift").review = `# Review

## Machine Findings

\`\`\`json
{"schemaVersion":"1.0","findings":[{"id":"invented-drift","classification":"formal-to-implementation","evidence":["targets/no-drift/reports/check.json"]}]}
\`\`\`
`;
    writeFileSync(mutatedAnswers, `${JSON.stringify(document, null, 2)}\n`);

    const result = run(["--json", suite, mutatedAnswers]);
    assert.equal(result.status, 1, result.stderr);
    const report = JSON.parse(result.stdout);
    const noDrift = report.cases.find((entry) => entry.id === "no-drift");
    assert.equal(noDrift.status, "fail");
    assert.deepEqual(noDrift.unexpectedFindingIds, ["invented-drift"]);
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});
