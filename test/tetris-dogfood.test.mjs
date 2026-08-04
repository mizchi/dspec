import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const cli = join(root, "src", "cli.mjs");
const hasAlloy = spawnSync("alloy6", ["version"], { encoding: "utf8" }).status === 0;

function runCli(args, env = {}) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: "utf8", env: { ...process.env, ...env } });
}

test("dogfoods the domain DSL with a bounded Tetris rules specification", () => {
  const check = runCli(["check", "examples/tetris.pkl"]);
  const relationships = runCli(["domain", "relationships", "--json", "examples/tetris.pkl"]);
  const markdown = runCli(["emit", "markdown", "--locale", "ja", "examples/tetris.pkl"]);
  const generated = runCli(["generated", "check", "--json", "examples/tetris.pkl"]);
  const traceability = runCli(["traceability", "--json", "examples/tetris.pkl"]);
  const traceabilityDocument = spawnSync(process.execPath, [
    "scripts/generate-traceability-report.mjs",
    "--check",
    "examples/tetris.pkl",
    "docs/generated/tetris/traceability.md",
  ], { cwd: root, encoding: "utf8" });

  assert.equal(check.status, 0, check.stderr);
  assert.equal(relationships.status, 0, relationships.stderr);
  assert.equal(markdown.status, 0, markdown.stderr);
  assert.equal(generated.status, 0, generated.stderr || generated.stdout);
  assert.equal(traceability.status, 0, traceability.stderr || traceability.stdout);
  assert.equal(traceabilityDocument.status, 0, traceabilityDocument.stderr || traceabilityDocument.stdout);
  const generatedReport = JSON.parse(generated.stdout);
  const traceabilityReport = JSON.parse(traceability.stdout);
  assert.equal(generatedReport.summary.artifacts, 2);
  assert.equal(traceabilityReport.status, "pass");
  assert.deepEqual(traceabilityReport.formalizations.map((formalization) => formalization.evidence.status), ["pass", "pass", "pass", "pass", "pass", "pass", "pass", "pass", "pass", "pass", "pass"]);
  assert.deepEqual(traceabilityReport.formalizations.flatMap((formalization) => formalization.mappings).map((mapping) => mapping.status), ["grounded", "grounded", "grounded", "grounded", "grounded", "grounded", "grounded", "grounded", "grounded", "grounded", "grounded", "grounded", "grounded", "grounded", "grounded"]);
  assert.deepEqual(traceabilityReport.refinements.map((refinement) => ({
    id: refinement.id,
    status: refinement.status,
    stateRelation: refinement.stateRelation,
    preserves: refinement.preserves,
    checks: refinement.checks.map((check) => check.status),
  })), [{
    id: "spawn-open-from-coordinates",
    status: "pass",
    stateRelation: "spawn-open is 1 exactly when the fixed spawn footprint has no locked coordinate",
    preserves: ["TETRIS-START-GAME"],
    checks: ["pass", "pass"],
  }]);
  const graph = JSON.parse(relationships.stdout);
  assert.ok(graph.edges.some((edge) => edge.from === "domain/invariant/gravity-locks-piece" && edge.relation === "states-rule" && edge.to === "rule/TETRIS-GRAVITY-LOCKS"));
  assert.ok(graph.edges.some((edge) => edge.from === "domain/formalization/gravity-lock-behavior" && edge.relation === "uses-artifact" && edge.to === "artifact/model/fixtures/tetris-gravity-behavior.pkl"));
  assert.ok(graph.edges.some((edge) => edge.from === "domain/refinement/spawn-open-from-coordinates" && edge.relation === "refines-to-formalization" && edge.to === "domain/formalization/coordinate-start-spawn-alloy"));
  assert.ok(graph.edges.some((edge) => edge.from === "domain/refinement/spawn-open-from-coordinates" && edge.relation === "states-relation" && edge.to === "formal-relation/spawn-open-from-coordinates"));
  assert.ok(graph.edges.some((edge) => edge.from === "domain/refinement/spawn-open-from-coordinates" && edge.relation === "preserves-rule" && edge.to === "rule/TETRIS-START-GAME"));
  assert.match(markdown.stdout, /## Domain Model/);
  assert.match(markdown.stdout, /重力で下降できないピースは固定される/);
  assert.match(markdown.stdout, /SRS、ホールド、T-spin、得点は今回の仕様範囲外/);
});

test("requires executed Alloy evidence instead of silently accepting reference-only traceability", () => {
  const result = runCli([
    "traceability",
    "--json",
    "--require-executed-formal-tools",
    "examples/tetris.pkl",
  ], { ALLOY6_COMMAND: "missing-alloy6" });

  assert.notEqual(result.status, 0, "required formal-tool evidence must reject a missing Alloy command");
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "fail");
  const alloyEvidence = report.formalizations.find((formalization) => formalization.id === "coordinate-blocked-spawn-alloy").evidence;
  assert.deepEqual(alloyEvidence.execution, {
    engine: "alloy6",
    command: "missing-alloy6",
    version: null,
    requested: true,
    status: "skip",
    reason: "alloy6 not found on PATH",
  });
});

test("records Alloy 6 execution evidence when the formal tool is available", { skip: !hasAlloy }, () => {
  const result = runCli([
    "traceability",
    "--json",
    "--require-executed-formal-tools",
    "examples/tetris.pkl",
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  const alloyEvidence = report.formalizations.find((formalization) => formalization.id === "coordinate-blocked-spawn-alloy").evidence;
  assert.equal(alloyEvidence.status, "pass");
  assert.equal(alloyEvidence.execution.engine, "alloy6");
  assert.equal(alloyEvidence.execution.command, "alloy6");
  assert.match(alloyEvidence.execution.version, /^\d+\.\d+\.\d+$/);
  assert.equal(alloyEvidence.execution.requested, true);
  assert.equal(alloyEvidence.execution.status, "pass");
  assert.equal(alloyEvidence.execution.reason, null);
  assert.equal(alloyEvidence.checks[0].assurance, "alloy6-bounded");
  assert.deepEqual(report.refinements.find((refinement) => refinement.id === "spawn-open-from-coordinates").checks, [
    {
      id: "tetris.coordinate-spawn.availability-refines-coordinates.holds",
      status: "pass",
      assurance: "alloy6-bounded",
    },
    {
      id: "tetris.coordinate-spawn.implementation-input-conforms.holds",
      status: "pass",
      assurance: "finite-coordinate-conformance",
    },
  ]);
});

test("runs the reusable formal mutation suite for the Tetris Alloy model", { skip: !hasAlloy }, () => {
  const result = runCli(["formal-mutation", "--json", "--require-formal-tools", "fixtures/tetris-alloy.pkl"]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "pass");
  assert.deepEqual(report.mutations.map((mutation) => ({ id: mutation.id, status: mutation.status })), [
    { id: "spawn-collision-starts-game", status: "detected" },
    { id: "blocked-spawn-is-marked-open", status: "detected" },
  ]);
});

test("checks the bounded gravity-to-lock formalization and its implementation grounding", () => {
  const result = spawnSync(process.execPath, ["scripts/verify-behavior.mjs", "fixtures/tetris-gravity-behavior.pkl"], {
    cwd: root,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "pass");
  assert.equal(report.reference.temporal.status, "pass");
  assert.equal(
    report.reference.temporal.checks.find((check) => check.id === "tetris.gravity-path-eventually-locks").assurance,
    "finite-scheduled-trace",
  );
  assert.equal(report.grounding.status, "pass");

  const generatedLean = spawnSync(process.execPath, [
    "scripts/generate-behavior-transition.mjs",
    "--check",
    "fixtures/tetris-gravity-behavior.pkl",
    "fixtures/behavior/TetrisGravityGenerated.lean",
  ], { cwd: root, encoding: "utf8" });
  assert.equal(generatedLean.status, 0, generatedLean.stderr || generatedLean.stdout);
});

test("checks spawn collision and terminal game-over as distinct bounded behaviors", () => {
  for (const [fixture, expectedCheck, generated] of [
    ["fixtures/tetris-spawn-game-over-behavior.pkl", "tetris.spawn-collision.game-over.reachable", "fixtures/behavior/TetrisSpawnGameOverGenerated.lean"],
    ["fixtures/tetris-terminal-game-over-behavior.pkl", "tetris.game-over.playing.unreachable", "fixtures/behavior/TetrisTerminalGameOverGenerated.lean"],
  ]) {
    const result = spawnSync(process.execPath, ["scripts/verify-behavior.mjs", fixture], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    assert.equal(report.reference.boundedReachability.checks.find((check) => check.id === expectedCheck).status, "pass");
    assert.equal(report.grounding.status, "pass");

    const generatedLean = spawnSync(process.execPath, [
      "scripts/generate-behavior-transition.mjs",
      "--check",
      fixture,
      generated,
    ], { cwd: root, encoding: "utf8" });
    assert.equal(generatedLean.status, 0, generatedLean.stderr || generatedLean.stdout);
  }
});

test("checks a clear spawn starts a game with one active piece", () => {
  const fixture = "fixtures/tetris-start-game-behavior.pkl";
  const result = spawnSync(process.execPath, ["scripts/verify-behavior.mjs", fixture], {
    cwd: root,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "pass");
  assert.equal(report.reference.boundedReachability.checks.find((check) => check.id === "tetris.start-game.started.reachable").status, "pass");
  assert.equal(report.reference.temporal.checks.find((check) => check.id === "tetris.start-game.eventually-started").status, "pass");
  assert.equal(report.grounding.status, "pass");

  const generatedLean = spawnSync(process.execPath, [
    "scripts/generate-behavior-transition.mjs",
    "--check",
    fixture,
    "fixtures/behavior/TetrisStartGameGenerated.lean",
  ], { cwd: root, encoding: "utf8" });
  assert.equal(generatedLean.status, 0, generatedLean.stderr || generatedLean.stdout);
});
