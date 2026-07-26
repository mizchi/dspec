import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { evaluatePklJson } from "../src/adapters/pkl.mjs";
import {
  compileTetrisAlloyModel,
  verifyTetrisAlloyMutationWithAnalyzer,
  verifyTetrisAlloyImplementation,
  verifyTetrisAlloyModel,
  verifyTetrisAlloyWithAnalyzer,
} from "../src/core/tetris-alloy.mjs";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const fixturePath = "fixtures/tetris-alloy.pkl";
const hasAlloy = spawnSync("alloy6", ["version"], { encoding: "utf8" }).status === 0;

function document() {
  return evaluatePklJson(fixturePath);
}

test("lowers the bounded Tetris occupancy and rotation contract to Alloy 6", () => {
  const compiled = compileTetrisAlloyModel(document());

  assert.deepEqual(compiled.model, {
    id: "tetris.board-rotation.alloy-v1",
    terms: ["tetris.active-piece", "tetris.board", "tetris.cell", "tetris.tetromino"],
    board: { width: 4, height: 4, initialLockedCells: 1 },
    tetromino: { id: "T", blockCount: 4 },
    spawnAvailabilityGrounding: {
      check: "tetris.coordinate-spawn.implementation-input-conforms.holds",
      implementation: {
        kind: "code",
        path: "fixtures/tetris-lifecycle-implementation.mjs",
        symbol: "spawnAvailability",
      },
    },
    checks: [
      { id: "tetris.board.bounds.holds", rule: "TETRIS-BOARD-BOUNDS", kind: "alwaysInBounds", expectation: "holds", maxSteps: 3 },
      { id: "tetris.board.disjoint.holds", rule: "TETRIS-NO-OVERLAP", kind: "alwaysDisjoint", expectation: "holds", maxSteps: 3 },
      { id: "tetris.rotation.collision-rejected.holds", rule: "TETRIS-LEGAL-ROTATION", kind: "collisionRotationRejected", expectation: "holds", maxSteps: 3 },
      { id: "tetris.translation.illegal-rejected.holds", rule: "TETRIS-LEGAL-TRANSLATION", kind: "illegalTranslationRejected", expectation: "holds", maxSteps: 3 },
      { id: "tetris.coordinate-spawn.clear-starts-game.holds", rule: "TETRIS-START-GAME", kind: "clearSpawnStartsGame", expectation: "holds", maxSteps: 1 },
      { id: "tetris.coordinate-spawn.blocked-game-over.holds", rule: "TETRIS-SPAWN-GAME-OVER", kind: "blockedSpawnGameOver", expectation: "holds", maxSteps: 1 },
      { id: "tetris.coordinate-spawn.availability-refines-coordinates.holds", rule: "TETRIS-START-GAME", kind: "spawnAvailabilityRefinesCoordinates", expectation: "holds", maxSteps: 1 },
    ],
  });
  assert.match(compiled.alloySource, /open util\/ordering\[Column\] as column/);
  assert.match(compiled.alloySource, /sig Cell \{\n  column: one Column,\n  row: one Row\n\}/);
  assert.match(compiled.alloySource, /fun translateLeft\[cells: set Cell\]: set Cell/);
  assert.match(compiled.alloySource, /pred acceptTranslateLeft/);
  assert.match(compiled.alloySource, /pred rejectTranslateLeft \{/);
  assert.match(compiled.alloySource, /one sig Board \{\n  cells: set Cell\n\}/);
  assert.match(compiled.alloySource, /#Board\.cells = 16/);
  assert.match(compiled.alloySource, /#Tetromino\.cells = 4/);
  assert.match(compiled.alloySource, /pred rotate \{/);
  assert.match(compiled.alloySource, /pred rejectRotation \{/);
  assert.match(compiled.alloySource, /one sig SpawnScenario/);
  assert.match(compiled.alloySource, /fun spawnCells: set Cell/);
  assert.match(compiled.alloySource, /assert CollisionRotationRejected \{/);
  assert.match(compiled.alloySource, /assert IllegalTranslationRejected \{/);
  assert.match(compiled.alloySource, /check CollisionRotationRejected for exactly 16 Cell, exactly 4 Column, exactly 4 Row, 3 steps/);
});

test("keeps a bounded domain-language witness for a rejected colliding rotation", () => {
  const report = verifyTetrisAlloyModel(document());

  assert.equal(report.status, "pass");
  assert.deepEqual(report.checks.map((check) => ({
    id: check.id,
    assurance: check.assurance,
    status: check.status,
  })), [
    { id: "tetris.board.bounds.holds", assurance: "bounded-relational-reference", status: "pass" },
    { id: "tetris.board.disjoint.holds", assurance: "bounded-relational-reference", status: "pass" },
    { id: "tetris.rotation.collision-rejected.holds", assurance: "bounded-relational-reference", status: "pass" },
    { id: "tetris.translation.illegal-rejected.holds", assurance: "bounded-relational-reference", status: "pass" },
    { id: "tetris.coordinate-spawn.clear-starts-game.holds", assurance: "bounded-relational-reference", status: "pass" },
    { id: "tetris.coordinate-spawn.blocked-game-over.holds", assurance: "bounded-relational-reference", status: "pass" },
    { id: "tetris.coordinate-spawn.availability-refines-coordinates.holds", assurance: "bounded-relational-reference", status: "pass" },
  ]);
  assert.ok(report.checks.every((check) => check.checkedCases > 0));
  assert.deepEqual(report.checks[2].witness.trace[1], {
    active: [[0, 1], [1, 1], [2, 1], [1, 2]],
    locked: [[1, 0]],
    requested: [[1, 0], [0, 1], [1, 1], [1, 2]],
    outcome: "rejected",
  });
  assert.deepEqual(report.checks[3].witness.trace[1], {
    active: [[0, 1], [1, 1], [2, 1], [1, 2]],
    locked: [[3, 3]],
    requested: [[0, 1], [1, 1], [0, 2]],
    outcome: "rejected",
  });
});

test("derives initial spawn acceptance and game-over from concrete board coordinates", () => {
  const model = document();

  const compiled = compileTetrisAlloyModel(model);
  const report = verifyTetrisAlloyModel(model);

  assert.match(compiled.alloySource, /one sig SpawnScenario/);
  assert.match(compiled.alloySource, /fun spawnCells: set Cell/);
  assert.match(compiled.alloySource, /assert ClearSpawnStartsGame/);
  assert.match(compiled.alloySource, /assert BlockedSpawnGameOver/);
  assert.match(compiled.alloySource, /assert SpawnAvailabilityRefinesCoordinates/);
  assert.equal(report.status, "pass");
  assert.deepEqual(report.checks.slice(-3).map((check) => ({
    id: check.id,
    checkedCases: check.checkedCases,
    status: check.status,
    witness: check.witness,
  })), [
    {
      id: "tetris.coordinate-spawn.clear-starts-game.holds",
      checkedCases: 16,
      status: "pass",
      witness: {
        locked: [[0, 0]],
        outcome: "started",
        spawn: [[0, 2], [1, 2], [2, 2], [1, 3]],
      },
    },
    {
      id: "tetris.coordinate-spawn.blocked-game-over.holds",
      checkedCases: 16,
      status: "pass",
      witness: {
        locked: [[0, 2]],
        outcome: "game-over",
        spawn: [[0, 2], [1, 2], [2, 2], [1, 3]],
      },
    },
    {
      id: "tetris.coordinate-spawn.availability-refines-coordinates.holds",
      checkedCases: 16,
      status: "pass",
      witness: {
        locked: [[0, 0]],
        outcome: "started",
        spawn: [[0, 2], [1, 2], [2, 2], [1, 3]],
        spawnOpen: 1,
      },
    },
  ]);
});

test("grounds coordinate-derived spawn availability against an implementation adapter", async () => {
  const report = await verifyTetrisAlloyImplementation(document(), { projectRoot });

  assert.equal(report.status, "pass");
  assert.equal(report.assurance, "finite-coordinate-conformance");
  assert.equal(report.check, "tetris.coordinate-spawn.implementation-input-conforms.holds");
  assert.equal(report.checkedCases, 16);
  assert.equal(report.counterexample, null);
  assert.ok(report.cases.every((entry) => entry.status === "pass"));
});

test("keeps a smallest coordinate witness when the spawn-availability adapter is wrong", async () => {
  const model = document();
  model.tetrisAlloy.spawnAvailabilityGrounding.implementation.symbol = "brokenSpawnAvailability";

  const report = await verifyTetrisAlloyImplementation(model, { projectRoot });

  assert.equal(report.status, "fail");
  assert.deepEqual(report.counterexample, {
    board: { width: 4, height: 4 },
    locked: [[0, 2]],
    expected: { spawnOpen: 0 },
    actual: { spawnOpen: 1 },
    error: null,
  });
});

test("renders a stable Alloy artifact for the bounded Tetris model", () => {
  const generate = spawnSync(process.execPath, [
    "scripts/generate-tetris-alloy.mjs",
    fixturePath,
    "fixtures/alloy-behavior/TetrisBoardGenerated.als",
  ], { cwd: projectRoot, encoding: "utf8" });
  assert.equal(generate.status, 0, generate.stderr || generate.stdout);

  const check = spawnSync(process.execPath, [
    "scripts/generate-tetris-alloy.mjs",
    "--check",
    fixturePath,
    "fixtures/alloy-behavior/TetrisBoardGenerated.als",
  ], { cwd: projectRoot, encoding: "utf8" });
  assert.equal(check.status, 0, check.stderr || check.stdout);
});

test("Alloy 6 checks the bounded Tetris assertions when the analyzer is installed", { skip: !hasAlloy }, () => {
  const report = verifyTetrisAlloyWithAnalyzer(document());

  assert.equal(report.status, "pass");
  assert.deepEqual(report.checks.map((check) => ({
    id: check.id,
    actual: check.actual,
    assurance: check.assurance,
    status: check.status,
  })), [
    { id: "tetris.board.bounds.holds", actual: "holds", assurance: "alloy6-bounded", status: "pass" },
    { id: "tetris.board.disjoint.holds", actual: "holds", assurance: "alloy6-bounded", status: "pass" },
    { id: "tetris.rotation.collision-rejected.holds", actual: "holds", assurance: "alloy6-bounded", status: "pass" },
    { id: "tetris.translation.illegal-rejected.holds", actual: "holds", assurance: "alloy6-bounded", status: "pass" },
    { id: "tetris.coordinate-spawn.clear-starts-game.holds", actual: "holds", assurance: "alloy6-bounded", status: "pass" },
    { id: "tetris.coordinate-spawn.blocked-game-over.holds", actual: "holds", assurance: "alloy6-bounded", status: "pass" },
    { id: "tetris.coordinate-spawn.availability-refines-coordinates.holds", actual: "holds", assurance: "alloy6-bounded", status: "pass" },
  ]);
});

test("Alloy 6 returns a counterexample when a blocked spawn incorrectly starts the game", { skip: !hasAlloy }, () => {
  const report = verifyTetrisAlloyMutationWithAnalyzer(document());

  assert.equal(report.status, "pass");
  assert.deepEqual(report.mutations.map((mutation) => ({
    id: mutation.id,
    check: mutation.check,
    status: mutation.status,
    actual: mutation.actual,
  })), [
    {
      id: "spawn-collision-starts-game",
      check: "tetris.coordinate-spawn.blocked-game-over.holds",
      status: "detected",
      actual: "violated",
    },
    {
      id: "blocked-spawn-is-marked-open",
      check: "tetris.coordinate-spawn.availability-refines-coordinates.holds",
      status: "detected",
      actual: "violated",
    },
  ]);
  for (const mutation of report.mutations) {
    const witness = mutation.counterexample;
    assert.equal(witness.outcome, "started");
    assert.equal(witness.spawnOpen, 1);
    assert.ok(witness.locked.some((locked) => witness.spawn.some((spawn) => locked[0] === spawn[0] && locked[1] === spawn[1])));
  }
});
