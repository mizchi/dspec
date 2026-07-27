import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { evaluatePklJson } from "../src/adapters/pkl.mjs";
import {
  compileTetrisLineClearAlloyModel,
  verifyTetrisLineClearAlloyModel,
  verifyTetrisLineClearAlloyWithAnalyzer,
} from "../src/core/tetris-line-clear-alloy.mjs";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const fixturePath = "fixtures/tetris-line-clear-alloy.pkl";
const hasAlloy = spawnSync("alloy6", ["version"], { encoding: "utf8" }).status === 0;

function document() {
  return evaluatePklJson(fixturePath);
}

test("lowers full-row clearing and compaction to a bounded Alloy relation", () => {
  const compiled = compileTetrisLineClearAlloyModel(document());

  assert.deepEqual(compiled.model, {
    id: "tetris.line-clear.alloy-v1",
    terms: ["tetris.board", "tetris.cell", "tetris.line-clear", "tetris.lock"],
    board: { width: 4, height: 4 },
    checks: [
      { id: "tetris.full-row.clear-and-compact.holds", rule: "TETRIS-CLEAR-FULL-ROWS", kind: "clearAndCompact", expectation: "holds", maxSteps: 2 },
    ],
  });
  assert.match(compiled.alloySource, /fun fullRows\[cells: set Cell\]: set Row/);
  assert.match(compiled.alloySource, /fun compacted\[cells: set Cell\]: set Cell/);
  assert.match(compiled.alloySource, /pred clearFullRows/);
  assert.match(compiled.alloySource, /assert FullRowsClearAndCompact/);
  assert.match(compiled.alloySource, /check FullRowsClearAndCompact for exactly 16 Cell, exactly 4 Column, exactly 4 Row, 2 steps/);
});

test("checks every finite locked-cell subset and preserves a line-clear witness", () => {
  const report = verifyTetrisLineClearAlloyModel(document());

  assert.equal(report.status, "pass");
  assert.deepEqual(report.checks.map((check) => ({
    id: check.id,
    assurance: check.assurance,
    status: check.status,
    checkedCases: check.checkedCases,
  })), [
    { id: "tetris.full-row.clear-and-compact.holds", assurance: "bounded-relational-reference", status: "pass", checkedCases: 65536 },
  ]);
  assert.deepEqual(report.checks[0].witness.trace, [
    {
      locked: [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [2, 2]],
      clearedRows: [],
      action: "idle",
    },
    {
      locked: [[0, 0], [2, 1]],
      clearedRows: [0],
      action: "clearFullRows",
    },
  ]);
});

test("renders a stable generated Alloy artifact for line clearing", () => {
  const generate = spawnSync(process.execPath, [
    "scripts/generate-tetris-line-clear-alloy.mjs",
    fixturePath,
    "fixtures/alloy-behavior/TetrisLineClearGenerated.als",
  ], { cwd: projectRoot, encoding: "utf8" });
  assert.equal(generate.status, 0, generate.stderr || generate.stdout);

  const check = spawnSync(process.execPath, [
    "scripts/generate-tetris-line-clear-alloy.mjs",
    "--check",
    fixturePath,
    "fixtures/alloy-behavior/TetrisLineClearGenerated.als",
  ], { cwd: projectRoot, encoding: "utf8" });
  assert.equal(check.status, 0, check.stderr || check.stdout);
});

test("Alloy 6 checks the bounded line-clear assertion when installed", { skip: !hasAlloy }, () => {
  const report = verifyTetrisLineClearAlloyWithAnalyzer(document());

  assert.equal(report.status, "pass");
  assert.deepEqual(report.checks.map((check) => ({
    id: check.id,
    actual: check.actual,
    assurance: check.assurance,
    status: check.status,
  })), [
    { id: "tetris.full-row.clear-and-compact.holds", actual: "holds", assurance: "alloy6-bounded", status: "pass" },
  ]);
});
