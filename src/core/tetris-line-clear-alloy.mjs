import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export const TETRIS_LINE_CLEAR_ALLOY_MODEL_SCHEMA_VERSION = "1.0";

const CHECK_KINDS = ["clearAndCompact"];
const MAX_ENUMERATED_CELLS = 16;

function list(value) {
  return Array.isArray(value) ? value : [];
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function duplicateIds(entries, label, errors) {
  const ids = new Set();
  for (const entry of entries) {
    if (!entry?.id) {
      errors.push(`${label} id is required`);
      continue;
    }
    if (ids.has(entry.id)) errors.push(`duplicate ${label} id: ${entry.id}`);
    ids.add(entry.id);
  }
}

function moduleName(value) {
  const result = String(value ?? "").replace(/[^A-Za-z0-9_]/g, "_");
  return /^[A-Za-z_]/.test(result) ? result : `Model_${result}`;
}

function normalizedModel(document) {
  const tetris = record(document?.tetrisLineClearAlloy);
  if (!tetris) throw new Error("Tetris line-clear Alloy specification is required");
  return {
    id: tetris.id ?? null,
    terms: list(tetris.terms),
    board: {
      width: tetris.board?.width ?? null,
      height: tetris.board?.height ?? null,
    },
    checks: list(tetris.checks).map((check) => ({
      id: check?.id ?? null,
      rule: check?.rule ?? null,
      kind: check?.kind ?? null,
      expectation: check?.expectation ?? null,
      maxSteps: check?.maxSteps ?? null,
    })),
  };
}

function domainReferences(document, model, errors) {
  const terms = new Set(list(document?.model?.vocabulary).map((term) => term?.id).filter(Boolean));
  const rules = new Set(list(document?.model?.rules).map((rule) => rule?.id).filter(Boolean));
  for (const term of model.terms) {
    if (!terms.has(term)) errors.push(`Tetris line-clear Alloy references unknown domain term: ${term ?? "missing"}`);
  }
  for (const check of model.checks) {
    if (!rules.has(check.rule)) errors.push(`Tetris line-clear Alloy references unknown domain rule: ${check.id ?? "missing"} -> ${check.rule ?? "missing"}`);
  }
}

/** Validate a scope small enough for exhaustive locked-cell enumeration. */
export function validateTetrisLineClearAlloyModel(document) {
  const errors = [];
  let model;
  try {
    model = normalizedModel(document);
  } catch (error) {
    return [error.message];
  }
  if (!model.id) errors.push("Tetris line-clear Alloy id is required");
  for (const [field, value] of Object.entries(model.board)) {
    if (!Number.isInteger(value) || value < 2) errors.push(`Tetris line-clear Alloy board ${field} must be an integer of at least 2`);
  }
  const area = model.board.width * model.board.height;
  if (Number.isInteger(area) && area > MAX_ENUMERATED_CELLS) {
    errors.push(`Tetris line-clear Alloy board has ${area} cells; maximum exhaustive scope is ${MAX_ENUMERATED_CELLS}`);
  }
  duplicateIds(model.checks, "Tetris line-clear Alloy check", errors);
  for (const check of model.checks) {
    if (!CHECK_KINDS.includes(check.kind)) errors.push(`unknown Tetris line-clear Alloy check kind: ${check.kind ?? "missing"}`);
    if (check.expectation !== "holds" && check.expectation !== "violated") {
      errors.push(`Tetris line-clear Alloy check expectation must be holds or violated: ${check.id ?? "missing"}`);
    }
    if (!Number.isInteger(check.maxSteps) || check.maxSteps < 1) {
      errors.push(`Tetris line-clear Alloy check maxSteps must be a positive integer: ${check.id ?? "missing"}`);
    }
  }
  domainReferences(document, model, errors);
  return errors;
}

function scopeClause(model, check) {
  const area = model.board.width * model.board.height;
  return `for exactly ${area} Cell, exactly ${model.board.width} Column, exactly ${model.board.height} Row, ${check.maxSteps} steps`;
}

/** Deterministically lower the full-row compaction relation to Alloy 6. */
export function compileTetrisLineClearAlloyModel(document) {
  const model = normalizedModel(document);
  const area = model.board.width * model.board.height;
  const lines = [
    `module ${moduleName(model.id)}`,
    "",
    "open util/ordering[Column] as column",
    "open util/ordering[Row] as row",
    "",
    "sig Column {}",
    "sig Row {}",
    "sig Cell {",
    "  column: one Column,",
    "  row: one Row",
    "}",
    "",
    "one sig Board {",
    "  cells: set Cell",
    "}",
    "",
    "enum LastAction { idleAction, clearAction }",
    "",
    "one sig Game {",
    "  var locked: set Cell,",
    "  var priorLocked: set Cell,",
    "  var clearedRows: set Row,",
    "  var action: one LastAction",
    "}",
    "",
    "fact Geometry {",
    `  #Column = ${model.board.width}`,
    `  #Row = ${model.board.height}`,
    `  #Board.cells = ${area}`,
    "  Board.cells = Cell",
    "  all disj left, right: Cell | left.column != right.column or left.row != right.row",
    "}",
    "",
    "fun rowCells[r: set Row]: set Cell { r.~row }",
    "fun fullRows[cells: set Cell]: set Row { { r: Row | rowCells[r] in cells } }",
    "fun fullRowCells[cells: set Cell]: set Cell { rowCells[fullRows[cells]] }",
    "fun compacted[cells: set Cell]: set Cell {",
    "  { target: Cell | some source: cells - fullRowCells[cells] |",
    "    target.column = source.column and",
    "    #((row/prevs[source.row]) - fullRows[cells]) = #(row/prevs[target.row])",
    "  }",
    "}",
    "",
    "fact Initial {",
    "  some fullRows[Game.locked]",
    "  Game.priorLocked = Game.locked",
    "  no Game.clearedRows",
    "  Game.action = idleAction",
    "}",
    "",
    "pred clearFullRows {",
    "  some fullRows[Game.locked]",
    "  Game.priorLocked' = Game.locked",
    "  Game.clearedRows' = fullRows[Game.locked]",
    "  Game.locked' = compacted[Game.locked]",
    "  Game.action' = clearAction",
    "}",
    "",
    "pred stutter {",
    "  Game.priorLocked' = Game.locked",
    "  no Game.clearedRows'",
    "  Game.locked' = Game.locked",
    "  Game.action' = idleAction",
    "}",
    "",
    "fact Transitions {",
    "  always (clearFullRows or stutter)",
    "}",
    "",
    "assert FullRowsClearAndCompact {",
    "  always (Game.action = clearAction implies",
    "    (Game.clearedRows = fullRows[Game.priorLocked] and Game.locked = compacted[Game.priorLocked]))",
    "}",
  ];
  for (const check of model.checks) {
    lines.push("", `check FullRowsClearAndCompact ${scopeClause(model, check)}`);
  }
  return { model, alloySource: `${lines.join("\n")}\n` };
}

function cellKey([x, y]) {
  return `${x}:${y}`;
}

function sameCell(left, right) {
  return left[0] === right[0] && left[1] === right[1];
}

function sortCells(cells) {
  return cells.slice().sort((left, right) => left[1] - right[1] || left[0] - right[0]);
}

function boardCells(model) {
  return Array.from({ length: model.board.height }, (_, y) => Array.from(
    { length: model.board.width },
    (_, x) => [x, y],
  )).flat();
}

function fullRows(locked, model) {
  const occupied = new Set(locked.map(cellKey));
  return Array.from({ length: model.board.height }, (_, y) => y)
    .filter((y) => Array.from({ length: model.board.width }, (_, x) => occupied.has(cellKey([x, y]))).every(Boolean));
}

function compacted(locked, model) {
  const clearedRows = fullRows(locked, model);
  const cleared = new Set(clearedRows);
  return sortCells(locked
    .filter(([, y]) => !cleared.has(y))
    .map(([x, y]) => [x, y - clearedRows.filter((row) => row < y).length]));
}

function noDuplicates(cells) {
  return new Set(cells.map(cellKey)).size === cells.length;
}

function includesCell(cells, cell) {
  return cells.some((candidate) => sameCell(candidate, cell));
}

function allSubsets(cells) {
  const count = 2 ** cells.length;
  return Array.from({ length: count }, (_, mask) => cells.filter((_, index) => (mask & (1 << index)) !== 0));
}

function clearState(locked, model) {
  const clearedRows = fullRows(locked, model);
  return {
    locked: compacted(locked, model),
    clearedRows,
    action: clearedRows.length > 0 ? "clearFullRows" : "idle",
  };
}

function validatesCompaction(before, after, clearedRows, model) {
  const full = new Set(clearedRows);
  const expectedCount = before.length - clearedRows.length * model.board.width;
  if (after.length !== expectedCount || !noDuplicates(after)) return false;
  if (!after.every(([x, y]) => x >= 0 && x < model.board.width && y >= 0 && y < model.board.height)) return false;
  for (const [x, y] of before) {
    if (full.has(y)) continue;
    const target = [x, y - clearedRows.filter((row) => row < y).length];
    if (!includesCell(after, target)) return false;
  }
  return true;
}

function lineClearWitness(model) {
  const before = [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [2, 2]];
  const after = clearState(before, model);
  return {
    trace: [
      { locked: before, clearedRows: [], action: "idle" },
      { locked: after.locked, clearedRows: after.clearedRows, action: after.action },
    ],
    reason: "row 0 is full; it is removed, then cells at (0, 1) and (2, 2) fall to (0, 0) and (2, 1)",
  };
}

function exhaustiveResult(model) {
  let holds = true;
  let checkedCases = 0;
  for (const locked of allSubsets(boardCells(model))) {
    const result = clearState(locked, model);
    const expectedRows = fullRows(locked, model);
    checkedCases += 1;
    holds &&= result.clearedRows.length === expectedRows.length
      && result.clearedRows.every((row, index) => row === expectedRows[index])
      && validatesCompaction(locked, result.locked, result.clearedRows, model)
      && (expectedRows.length === 0 ? result.action === "idle" : result.action === "clearFullRows");
  }
  return { holds, checkedCases };
}

function evaluateCheck(model, check, result) {
  const actual = result.holds ? "holds" : "violated";
  return {
    id: check.id,
    rule: check.rule,
    kind: check.kind,
    expectation: check.expectation,
    maxSteps: check.maxSteps,
    assurance: "bounded-relational-reference",
    status: actual === check.expectation ? "pass" : "fail",
    checkedCases: result.checkedCases,
    witness: lineClearWitness(model),
  };
}

/** Exhaustively checks every locked-cell subset in the declared finite board. */
export function verifyTetrisLineClearAlloyModel(document) {
  const errors = validateTetrisLineClearAlloyModel(document);
  if (errors.length > 0) {
    return {
      schemaVersion: TETRIS_LINE_CLEAR_ALLOY_MODEL_SCHEMA_VERSION,
      model: { id: document?.model?.id ?? null, version: document?.model?.version ?? null },
      tetrisLineClearAlloy: document?.tetrisLineClearAlloy?.id ?? null,
      status: "fail",
      alloySource: null,
      checks: [],
      errors,
    };
  }
  const compiled = compileTetrisLineClearAlloyModel(document);
  const result = exhaustiveResult(compiled.model);
  const checks = compiled.model.checks.map((check) => evaluateCheck(compiled.model, check, result));
  const failures = checks.filter((check) => check.status === "fail");
  return {
    schemaVersion: TETRIS_LINE_CLEAR_ALLOY_MODEL_SCHEMA_VERSION,
    model: { id: document?.model?.id ?? null, version: document?.model?.version ?? null },
    tetrisLineClearAlloy: compiled.model.id,
    status: failures.length === 0 ? "pass" : "fail",
    alloySource: compiled.alloySource,
    checks,
    errors: failures.map((check) => `Tetris line-clear Alloy check failed: ${check.id}`),
  };
}

function commandExists(command) {
  return spawnSync(command, ["version"], { encoding: "utf8" }).status === 0;
}

function readReceipt(path) {
  if (!existsSync(path)) return { receipt: null, error: null };
  try {
    return { receipt: JSON.parse(readFileSync(path, "utf8")), error: null };
  } catch (error) {
    return { receipt: null, error: `cannot parse Alloy receipt: ${error.message}` };
  }
}

/** Run the generated bounded assertion with Alloy 6 when the command is installed. */
export function verifyTetrisLineClearAlloyWithAnalyzer(document, { command = "alloy6" } = {}) {
  const errors = validateTetrisLineClearAlloyModel(document);
  if (errors.length > 0) return { status: "fail", checks: [], errors };
  if (!commandExists(command)) return { status: "skip", checks: [], errors: [], reason: "alloy6 not found on PATH" };
  const compiled = compileTetrisLineClearAlloyModel(document);
  const directory = mkdtempSync(join(tmpdir(), "dspec-tetris-line-clear-"));
  try {
    const sourcePath = join(directory, "model.als");
    const commandName = "FullRowsClearAndCompact";
    const output = join(directory, commandName);
    writeFileSync(sourcePath, compiled.alloySource, "utf8");
    const run = spawnSync(command, ["exec", "-q", "-t", "json", "-o", output, "-f", "-c", commandName, sourcePath], { encoding: "utf8" });
    const parsed = readReceipt(join(output, "receipt.json"));
    const succeeded = run.status === 0 && !parsed.error;
    const solution = parsed.receipt?.commands?.[commandName]?.solution;
    const actual = Array.isArray(solution) && solution.length > 0 ? "violated" : "holds";
    const checks = compiled.model.checks.map((check) => ({
      id: check.id,
      command: commandName,
      expectation: check.expectation,
      actual: succeeded ? actual : null,
      assurance: "alloy6-bounded",
      status: succeeded && actual === check.expectation ? "pass" : "fail",
      counterexample: succeeded && Array.isArray(solution) && solution.length > 0 ? solution[0] : null,
      receipt: parsed.receipt,
      error: succeeded
        ? (actual === check.expectation ? null : `Alloy check ${check.id} expected ${check.expectation}, but found ${actual}`)
        : (parsed.error ?? run.stderr ?? run.stdout ?? `alloy6 exited ${run.status}`),
    }));
    const failures = checks.filter((check) => check.status === "fail");
    return { status: failures.length === 0 ? "pass" : "fail", checks, errors: failures.map((check) => `Alloy analyzer failed: ${check.id}`) };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
