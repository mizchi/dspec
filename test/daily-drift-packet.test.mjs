import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(root, "scripts", "generate-daily-drift-packet.mjs");
const cli = join(root, "src", "cli.mjs");
const selfManifest = "fixtures/daily-drift-targets-self.pkl";
const webappManifest = "fixtures/daily-drift-targets-webapp.pkl";
const selfReview = "fixtures/daily-drift-self-review.pkl";
const runtimeReview = "fixtures/daily-drift-runtime-review.pkl";
const webappReview = "fixtures/daily-drift-webapp-review.pkl";

function run(args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

function runCli(args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

test("exposes daily packet collection and approved baselines through dspec", () => {
  const output = mkdtempSync(join(tmpdir(), "dspec-daily-drift-cli-"));
  const baseline = join(output, "approved-baseline.json");
  try {
    const collected = runCli([
      "daily-drift",
      "collect",
      "--generated-at",
      "2026-07-16T00:00:00.000Z",
      "--output",
      output,
      selfManifest,
    ]);
    assert.equal(collected.status, 0, collected.stderr);
    assert.equal(JSON.parse(collected.stdout).status, "pass");

    const approved = runCli([
      "daily-drift",
      "approve",
      "--approved-by",
      "reviewer@example.test",
      "--approval-id",
      "ADR-DAILY-CLI-001",
      "--baseline",
      baseline,
      "--spec-change-review",
      `dspec-self=${selfReview}`,
      "--output",
      output,
      selfManifest,
    ]);
    assert.equal(approved.status, 0, approved.stderr);
    assert.equal(JSON.parse(readFileSync(baseline, "utf8")).approval.id, "ADR-DAILY-CLI-001");
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});

test("publishes daily drift packet dependencies with the CLI", () => {
  const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.ok(packageJson.files.includes("scripts"));
  assert.ok(packageJson.files.includes("skills"));
});

test("approves and then collects every declared daily target through its review ledger", () => {
  const output = mkdtempSync(join(tmpdir(), "dspec-daily-drift-ledger-"));
  const baseline = join(output, "approved-baseline.json");
  try {
    const approved = runCli([
      "daily-drift",
      "approve",
      "--approved-by",
      "reviewer@example.test",
      "--approval-id",
      "ADR-DAILY-LEDGER-001",
      "--baseline",
      baseline,
      "--spec-change-review",
      `dspec-self=${selfReview}`,
      "--spec-change-review",
      `sample-webapp=${webappReview}`,
      "--spec-change-review",
      `runtime-evidence=${runtimeReview}`,
      "--output",
      output,
      "examples/daily-drift-targets.pkl",
    ]);
    assert.equal(approved.status, 0, approved.stderr);
    const ledger = JSON.parse(readFileSync(baseline, "utf8"));
    assert.deepEqual(ledger.specChangeReviews.map((review) => review.targetId).sort(), [
      "dspec-self",
      "runtime-evidence",
      "sample-webapp",
    ]);

    const collected = runCli([
      "daily-drift",
      "collect",
      "--baseline",
      baseline,
      "--output",
      output,
      "examples/daily-drift-targets.pkl",
    ]);
    assert.equal(collected.status, 0, collected.stderr);
    assert.equal(JSON.parse(collected.stdout).status, "pass");
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});

test("writes typed target reports and declared implementation observations", () => {
  const output = mkdtempSync(join(tmpdir(), "dspec-daily-drift-packet-"));
  try {
    const result = run([
      "--generated-at",
      "2026-07-16T00:00:00.000Z",
      "--output",
      output,
      selfManifest,
    ]);

    assert.equal(result.status, 0, result.stderr);
    const summary = JSON.parse(readFileSync(join(output, "summary.json"), "utf8"));
    assert.equal(summary.status, "pass");
    assert.equal(summary.generatedAt, "2026-07-16T00:00:00.000Z");
    assert.match(summary.provenance.git.commit, /^[0-9a-f]{40}$/);
    assert.equal(typeof summary.provenance.git.dirty, "boolean");
    assert.match(summary.provenance.inputs.skill.digest, /^sha256:[a-f0-9]{64}$/);
    assert.match(summary.provenance.tools.node, /^v24\./);
    assert.equal(summary.targets.length, 1);
    assert.equal(summary.targets[0].id, "dspec-self");
    assert.deepEqual(summary.targets[0].checks.map((check) => check.id), [
      "check",
      "drift",
      "coverage",
      "intent-graph",
      "generated",
      "verify-generated",
      "render-en",
      "render-ja",
    ]);
    assert.ok(summary.targets[0].checks.every((check) => check.status === "pass"));
    assert.match(summary.targets[0].checks.find((check) => check.id === "drift").args.join(" "), /drift --json examples\/dspec\.pkl/);
    assert.ok(
      summary.targets[0].checks.find((check) => check.id === "verify-generated").args.includes("--skip-quint-verify"),
    );
    assert.equal(JSON.parse(readFileSync(join(output, "targets", "dspec-self", "reports", "intent-graph.json"), "utf8")).status, "pass");
    assert.match(readFileSync(join(output, "targets", "dspec-self", "review", "render-ja.md"), "utf8"), /DSpec/);
    assert.match(readFileSync(join(output, "prompt.md"), "utf8"), /skill\/SKILL\.md/);
    assert.ok(existsSync(join(output, "skill", "SKILL.md")));
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});

test("retains every report when a target's deterministic drift checks fail", () => {
  const output = mkdtempSync(join(tmpdir(), "dspec-daily-drift-failure-"));
  try {
    const result = run(["--output", output, "fixtures/daily-drift-targets-invalid.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const summary = JSON.parse(readFileSync(join(output, "summary.json"), "utf8"));
    assert.equal(summary.status, "fail");
    const target = summary.targets[0];
    assert.ok(target.checks.some((check) => check.id === "check" && check.status === "fail"));
    assert.ok(target.checks.every((check) => existsSync(join(output, check.stdout))));

    const strict = run(["--fail-on-drift", "--output", output, "fixtures/daily-drift-targets-invalid.pkl"]);
    assert.equal(strict.status, 1, strict.stderr);
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});

test("runs an application target's implementation observation gate", () => {
  const output = mkdtempSync(join(tmpdir(), "dspec-daily-drift-webapp-"));
  try {
    const result = run(["--output", output, webappManifest]);

    assert.equal(result.status, 0, result.stderr);
    const summary = JSON.parse(readFileSync(join(output, "summary.json"), "utf8"));
    const target = summary.targets.find((candidate) => candidate.id === "sample-webapp");
    assert.equal(target.status, "pass");
    const contract = target.checks.find((check) => check.id === "app-profile-contract");
    assert.equal(contract.status, "pass");
    const observation = target.checks.find((check) => check.id === "app-profile");
    assert.deepEqual(observation.args, ["check-app-profile", "--json", "fixtures/sample-webapp-profile.pkl"]);
    const report = JSON.parse(readFileSync(join(output, observation.stdout), "utf8"));
    assert.deepEqual(report.checks.map((check) => check.id), [
      "check",
      "drift",
      "domain-coverage",
      "import-real-app",
      "observed-fixture",
      "reconcile-real-app",
      "reverse-coverage",
    ]);
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});

test("rejects an application profile that omits reconciliation gates", () => {
  const output = mkdtempSync(join(tmpdir(), "dspec-daily-drift-underobserved-"));
  try {
    const result = run(["--output", output, "fixtures/daily-drift-targets-underobserved-webapp.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const summary = JSON.parse(readFileSync(join(output, "summary.json"), "utf8"));
    assert.equal(summary.status, "fail");
    const target = summary.targets[0];
    const contract = target.checks.find((check) => check.id === "app-profile-contract");
    assert.equal(contract.status, "fail");
    assert.match(readFileSync(join(output, contract.stdout), "utf8"), /missing required application observation gate: reconcile-real-app/);
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});

test("runs declared runtime evidence as a target observation gate", () => {
  const output = mkdtempSync(join(tmpdir(), "dspec-daily-drift-runtime-"));
  try {
    const result = run(["--output", output, "fixtures/daily-drift-targets-runtime.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const summary = JSON.parse(readFileSync(join(output, "summary.json"), "utf8"));
    const observation = summary.targets[0].checks.find((check) => check.id === "runtime-evidence");
    assert.equal(observation.status, "pass");
    assert.match(observation.args.join(" "), /verify-runtime-evidence --json fixtures\/runtime-evidence-collector\.json/);
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});

test("keeps a collection-failure packet when a declared target cannot be read", () => {
  const output = mkdtempSync(join(tmpdir(), "dspec-daily-drift-collection-failure-"));
  try {
    const result = run(["--output", output, "fixtures/daily-drift-targets-missing-model.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const summary = JSON.parse(readFileSync(join(output, "summary.json"), "utf8"));
    assert.equal(summary.status, "fail");
    assert.equal(summary.collection.status, "complete");
    assert.equal(summary.targets[0].model.digest, null);
    assert.match(summary.targets[0].model.error, /ENOENT/);
    assert.ok(existsSync(join(output, "prompt.md")));
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});

test("requires an explicit approval to establish and then enforce a target baseline", () => {
  const output = mkdtempSync(join(tmpdir(), "dspec-daily-drift-baseline-packet-"));
  const baseline = join(output, "approved-baseline.json");
  try {
    const missing = run(["--baseline", baseline, "--output", output, selfManifest]);
    assert.equal(missing.status, 0, missing.stderr);
    const missingSummary = JSON.parse(readFileSync(join(output, "summary.json"), "utf8"));
    assert.equal(missingSummary.status, "fail");
    assert.equal(missingSummary.targets[0].checks.at(-1).id, "baseline");
    assert.equal(missingSummary.targets[0].checks.at(-1).status, "fail");
    const missingReport = JSON.parse(readFileSync(join(output, missingSummary.targets[0].checks.at(-1).stdout), "utf8"));
    assert.deepEqual(missingReport.remediation.command, [
      "node",
      "src/cli.mjs",
      "daily-drift",
      "approve",
      "--approved-by",
      "<identity>",
      "--approval-id",
      "<approval-id>",
      "--baseline",
      baseline,
      "--spec-change-review",
      "dspec-self=<review.pkl>",
      selfManifest,
    ]);
    assert.deepEqual(missingReport.remediation.installedCommand, [
      "dspec",
      "daily-drift",
      "approve",
      "--approved-by",
      "<identity>",
      "--approval-id",
      "<approval-id>",
      "--baseline",
      baseline,
      "--spec-change-review",
      "dspec-self=<review.pkl>",
      selfManifest,
    ]);

    const mismatchedReview = run([
      "--write-baseline",
      "--approved-by",
      "reviewer@example.test",
      "--approval-id",
      "ADR-DAILY-MISMATCH",
      "--baseline",
      baseline,
      "--spec-change-review",
      "dspec-self=fixtures/spec-change-review-breaking-approved.pkl",
      "--output",
      output,
      selfManifest,
    ]);
    assert.equal(mismatchedReview.status, 0, mismatchedReview.stderr);
    const mismatchedSummary = JSON.parse(readFileSync(join(output, "summary.json"), "utf8"));
    assert.equal(mismatchedSummary.status, "fail");
    assert.match(mismatchedSummary.collection.errors.join("\n"), /after model does not match target dspec-self/);
    assert.equal(existsSync(baseline), false);

    const accepted = run([
      "--write-baseline",
      "--approved-by",
      "reviewer@example.test",
      "--approval-id",
      "ADR-DAILY-001",
      "--baseline",
      baseline,
      "--spec-change-review",
      `dspec-self=${selfReview}`,
      "--output",
      output,
      selfManifest,
    ]);
    assert.equal(accepted.status, 0, accepted.stderr);
    const baselineDocument = JSON.parse(readFileSync(baseline, "utf8"));
    assert.equal(baselineDocument.approval.id, "ADR-DAILY-001");
    assert.equal(baselineDocument.approval.by, "reviewer@example.test");
    assert.equal(baselineDocument.specChangeReviews[0].targetId, "dspec-self");
    assert.equal(baselineDocument.specChangeReviews[0].review.id, "daily-drift-self-review");

    const matched = run(["--baseline", baseline, "--output", output, selfManifest]);
    assert.equal(matched.status, 0, matched.stderr);
    const matchedSummary = JSON.parse(readFileSync(join(output, "summary.json"), "utf8"));
    assert.equal(matchedSummary.status, "pass");

    baselineDocument.targets[0].model.digest = "sha256:0000000000000000000000000000000000000000000000000000000000000000";
    writeFileSync(baseline, `${JSON.stringify(baselineDocument, null, 2)}\n`);
    const changed = run(["--baseline", baseline, "--output", output, selfManifest]);
    assert.equal(changed.status, 0, changed.stderr);
    const changedSummary = JSON.parse(readFileSync(join(output, "summary.json"), "utf8"));
    assert.equal(changedSummary.status, "fail");
    assert.match(readFileSync(join(output, changedSummary.targets[0].checks.at(-1).stdout), "utf8"), /model digest changed/);
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});

test("keeps the daily LLM drift review read-only and artifact-only", () => {
  const workflow = readFileSync(join(root, ".github", "workflows", "daily-drift-review.yml"), "utf8");
  const skill = readFileSync(join(root, "skills", "dspec-intent-formal-implementation-drift", "SKILL.md"), "utf8");
  const taskfile = readFileSync(join(root, "Taskfile.pkl"), "utf8");

  assert.match(taskfile, /name = "daily-drift:packet"/);
  assert.match(taskfile, /tasks \{[\s\S]*dailyDriftPacket/);
  assert.match(workflow, /schedule:\s*\n\s*- cron:/);
  assert.match(workflow, /runs-on: macos-latest/);
  assert.match(workflow, /generate-daily-drift-packet\.mjs --fail-on-drift --require-formal-tools/);
  assert.match(workflow, /uses: openai\/codex-action@[a-f0-9]{40}/);
  assert.match(workflow, /sandbox: read-only/);
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.match(workflow, /llm-review:[\s\S]*?permissions: \{\}/);
  assert.doesNotMatch(workflow, /llm-review:[\s\S]*?actions\/checkout/);
  assert.match(workflow, /actions\/upload-artifact@[a-f0-9]{40}/);
  assert.match(workflow, /actions\/download-artifact@[a-f0-9]{40}/);
  assert.doesNotMatch(workflow, /issues: write|pull-requests: write|contents: write/);
  assert.match(skill, /Treat deterministic reports as the evidence base/);
  assert.match(skill, /Never edit the source model/);
  assert.match(skill, /Machine Findings/);
  assert.match(taskfile, /name = "daily-drift:eval"/);
});
