import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

export const TETRIS_ALLOY_MODEL_SCHEMA_VERSION = "1.0";

const CHECK_KINDS = ["alwaysInBounds", "alwaysDisjoint", "collisionRotationRejected", "illegalTranslationRejected", "clearSpawnStartsGame", "blockedSpawnGameOver", "spawnAvailabilityRefinesCoordinates"];
const ORIENTATIONS = ["north", "east", "south", "west"];

const TETRIS_ALLOY_MUTATIONS = [{
  id: "spawn-collision-starts-game",
  checkKind: "blockedSpawnGameOver",
  spawnCollisionOutcome: "spawnStarted",
  description: "A blocked spawn incorrectly reports spawnStarted instead of spawnGameOver.",
}, {
  id: "blocked-spawn-is-marked-open",
  checkKind: "spawnAvailabilityRefinesCoordinates",
  spawnCollisionOutcome: "spawnStarted",
  description: "A blocked spawn is incorrectly classified as the abstract spawn-open input.",
}];

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

function assertionName(kind) {
  if (kind === "alwaysInBounds") return "BoardBounds";
  if (kind === "alwaysDisjoint") return "ActiveAndLockedDisjoint";
  if (kind === "collisionRotationRejected") return "CollisionRotationRejected";
  if (kind === "illegalTranslationRejected") return "IllegalTranslationRejected";
  if (kind === "clearSpawnStartsGame") return "ClearSpawnStartsGame";
  if (kind === "blockedSpawnGameOver") return "BlockedSpawnGameOver";
  if (kind === "spawnAvailabilityRefinesCoordinates") return "SpawnAvailabilityRefinesCoordinates";
  throw new Error(`unknown Tetris Alloy check: ${kind}`);
}

function normalizedModel(document) {
  const tetris = record(document?.tetrisAlloy);
  if (!tetris) throw new Error("Tetris Alloy specification is required");
  return {
    id: tetris.id ?? null,
    terms: list(tetris.terms),
    board: {
      width: tetris.board?.width ?? null,
      height: tetris.board?.height ?? null,
      initialLockedCells: tetris.board?.initialLockedCells ?? null,
    },
    tetromino: {
      id: tetris.tetromino?.id ?? null,
      blockCount: tetris.tetromino?.blockCount ?? null,
    },
    spawnAvailabilityGrounding: tetris.spawnAvailabilityGrounding
      ? {
        check: tetris.spawnAvailabilityGrounding.check ?? null,
        implementation: {
          kind: tetris.spawnAvailabilityGrounding.implementation?.kind ?? null,
          path: tetris.spawnAvailabilityGrounding.implementation?.path ?? null,
          symbol: tetris.spawnAvailabilityGrounding.implementation?.symbol ?? null,
        },
      }
      : null,
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
    if (!terms.has(term)) errors.push(`Tetris Alloy references unknown domain term: ${term ?? "missing"}`);
  }
  for (const check of model.checks) {
    if (!rules.has(check.rule)) errors.push(`Tetris Alloy references unknown domain rule: ${check.id ?? "missing"} -> ${check.rule ?? "missing"}`);
  }
}

/** Validate the intentionally finite, occupancy-only relational abstraction. */
export function validateTetrisAlloyModel(document) {
  const errors = [];
  let model;
  try {
    model = normalizedModel(document);
  } catch (error) {
    return [error.message];
  }
  if (!model.id) errors.push("Tetris Alloy id is required");
  const area = model.board.width * model.board.height;
  for (const [field, value] of Object.entries(model.board)) {
    if (!Number.isInteger(value) || value < 1) errors.push(`Tetris Alloy board ${field} must be a positive integer`);
  }
  if (!model.tetromino.id) errors.push("Tetris Alloy tetromino id is required");
  if (model.tetromino.blockCount !== 4) errors.push("Tetris Alloy tetromino blockCount must be exactly 4");
  if (Number.isInteger(area) && Number.isInteger(model.tetromino.blockCount)
    && Number.isInteger(model.board.initialLockedCells)
    && area < model.tetromino.blockCount + model.board.initialLockedCells) {
    errors.push("Tetris Alloy board has insufficient cells for the active tetromino and locked witness");
  }
  duplicateIds(model.checks, "Tetris Alloy check", errors);
  if (model.spawnAvailabilityGrounding) {
    const grounding = model.spawnAvailabilityGrounding;
    if (!grounding.check) errors.push("Tetris Alloy spawn availability grounding check is required");
    if (model.checks.some((check) => check.id === grounding.check)) {
      errors.push(`Tetris Alloy spawn availability grounding check duplicates model check: ${grounding.check}`);
    }
    const implementation = grounding.implementation;
    if (implementation.kind !== "code" || !implementation.path || !implementation.symbol) {
      errors.push("Tetris Alloy spawn availability grounding requires a code path and symbol");
    }
  }
  for (const check of model.checks) {
    if (!CHECK_KINDS.includes(check.kind)) errors.push(`unknown Tetris Alloy check kind: ${check.kind ?? "missing"}`);
    if (check.expectation !== "holds" && check.expectation !== "violated") {
      errors.push(`Tetris Alloy check expectation must be holds or violated: ${check.id ?? "missing"}`);
    }
    if (!Number.isInteger(check.maxSteps) || check.maxSteps < 1) {
      errors.push(`Tetris Alloy check maxSteps must be a positive integer: ${check.id ?? "missing"}`);
    }
  }
  if (model.checks.some((check) => check.kind === "clearSpawnStartsGame" || check.kind === "blockedSpawnGameOver" || check.kind === "spawnAvailabilityRefinesCoordinates")
    && (model.board.width < 3 || model.board.height < 3)) {
    errors.push("Tetris Alloy coordinate spawn checks require a board at least 3 by 3");
  }
  domainReferences(document, model, errors);
  return errors;
}

function scopeClause(model, check) {
  return `for exactly ${model.board.width * model.board.height} Cell, exactly ${model.board.width} Column, exactly ${model.board.height} Row, ${check.maxSteps} steps`;
}

function assertionSource(check) {
  const name = assertionName(check.kind);
  if (check.kind === "alwaysInBounds") {
    return [
      `assert ${name} {`,
      "  always (Game.active + Game.locked in Board.cells)",
      "}",
    ];
  }
  if (check.kind === "alwaysDisjoint") {
    return [
      `assert ${name} {`,
      "  always no (Game.active & Game.locked)",
      "}",
    ];
  }
  if (check.kind === "collisionRotationRejected") return [
    `assert ${name} {`,
    "  always ((Game.action = rotation and (#Game.requested != 4 or some (Game.requested & Game.locked))) implies",
    "    (Game.outcome = rejected and Game.active = Game.priorActive and Game.pivot = Game.priorPivot and Game.orientation = Game.priorOrientation))",
    "}",
  ];
  if (check.kind === "clearSpawnStartsGame") return [
    `assert ${name} {`,
    "  no (SpawnScenario.spawn & SpawnScenario.locked) implies",
    "    (SpawnScenario.outcome = spawnStarted and SpawnScenario.spawn = spawnCells)",
    "}",
  ];
  if (check.kind === "blockedSpawnGameOver") return [
    `assert ${name} {`,
    "  some (SpawnScenario.spawn & SpawnScenario.locked) implies SpawnScenario.outcome = spawnGameOver",
    "}",
  ];
  if (check.kind === "spawnAvailabilityRefinesCoordinates") return [
    `assert ${name} {`,
    "  (SpawnScenario.availability = spawnOpen) iff no (SpawnScenario.spawn & SpawnScenario.locked)",
    "}",
  ];
  return [
    `assert ${name} {`,
    "  always ((Game.action = translationLeft and (#Game.requested != 4 or some (Game.requested & Game.locked))) implies",
    "    (Game.outcome = rejected and Game.active = Game.priorActive and Game.pivot = Game.priorPivot and Game.orientation = Game.priorOrientation))",
    "}",
  ];
}

/** Deterministically lower the bounded Tetris relational vocabulary to Alloy 6. */
export function compileTetrisAlloyModel(document, { spawnCollisionOutcome = "spawnGameOver" } = {}) {
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
    "",
    "sig Cell {",
    "  column: one Column,",
    "  row: one Row",
    "}",
    "",
    "one sig Board {",
    "  cells: set Cell",
    "}",
    "",
    "one sig Tetromino {",
    "  cells: set Cell",
    "}",
    "",
    "enum Orientation { north, east, south, west }",
    "enum LastAction { idleAction, rotation, translationLeft }",
    "enum ActionOutcome { idleOutcome, accepted, rejected }",
    "enum SpawnOutcome { spawnStarted, spawnGameOver }",
    "enum SpawnAvailability { spawnOpen, spawnBlocked }",
    "",
    "one sig Game {",
    "  var active: set Cell,",
    "  var locked: set Cell,",
    "  var requested: set Cell,",
    "  var priorActive: set Cell,",
    "  var pivot: one Cell,",
    "  var priorPivot: one Cell,",
    "  var orientation: one Orientation,",
    "  var priorOrientation: one Orientation,",
    "  var action: one LastAction,",
    "  var outcome: one ActionOutcome",
    "}",
    "",
    "one sig SpawnScenario {",
    "  locked: set Cell,",
    "  spawn: set Cell,",
    "  availability: one SpawnAvailability,",
    "  outcome: one SpawnOutcome",
    "}",
    "",
    "fact Geometry {",
    `  #Column = ${model.board.width}`,
    `  #Row = ${model.board.height}`,
    `  #Board.cells = ${area}`,
    "  Board.cells = Cell",
    `  #Tetromino.cells = ${model.tetromino.blockCount}`,
    "  all disj left, right: Cell | left.column != right.column or left.row != right.row",
    "}",
    "",
    "fun at[c: set Column, r: set Row]: set Cell { c.~column & r.~row }",
    "fun northShape[p: Cell]: set Cell { at[column/prev[p.column], p.row] + p + at[column/next[p.column], p.row] + at[p.column, row/next[p.row]] }",
    "fun eastShape[p: Cell]: set Cell { at[p.column, row/prev[p.row]] + p + at[p.column, row/next[p.row]] + at[column/prev[p.column], p.row] }",
    "fun southShape[p: Cell]: set Cell { at[column/prev[p.column], p.row] + p + at[column/next[p.column], p.row] + at[p.column, row/prev[p.row]] }",
    "fun westShape[p: Cell]: set Cell { at[p.column, row/prev[p.row]] + p + at[p.column, row/next[p.row]] + at[column/next[p.column], p.row] }",
    "fun shape[p: Cell, o: Orientation]: set Cell {",
    "  (o = north) => northShape[p] else",
    "  (o = east) => eastShape[p] else",
    "  (o = south) => southShape[p] else westShape[p]",
    "}",
    "fun spawnPivot: one Cell { at[column/next[column/first], row/next[row/next[row/first]]] }",
    "fun spawnCells: set Cell { shape[spawnPivot, north] }",
    "fun clockwise[o: Orientation]: one Orientation {",
    "  (o = north) => east else (o = east) => south else (o = south) => west else north",
    "}",
    "fun translateLeft[cells: set Cell]: set Cell {",
    "  { target: Cell | some source: cells | target.row = source.row and target.column = column/prev[source.column] }",
    "}",
    "",
    "fact Initial {",
    "  Game.orientation = north",
    `  #shape[Game.pivot, Game.orientation] = ${model.tetromino.blockCount}`,
    "  Game.active = shape[Game.pivot, Game.orientation]",
    `  #Game.locked = ${model.board.initialLockedCells}`,
    "  Game.active + Game.locked in Board.cells",
    "  no (Game.active & Game.locked)",
    "  Game.priorActive = Game.active",
    "  Game.priorPivot = Game.pivot",
    "  Game.priorOrientation = Game.orientation",
    "  no Game.requested",
    "  Game.action = idleAction",
    "  Game.outcome = idleOutcome",
    "}",
    "",
    "fact SpawnScenarioSemantics {",
    `  #SpawnScenario.locked = ${model.board.initialLockedCells}`,
    `  #SpawnScenario.spawn = ${model.tetromino.blockCount}`,
    "  SpawnScenario.spawn = spawnCells",
    "  (no (SpawnScenario.spawn & SpawnScenario.locked)) implies SpawnScenario.outcome = spawnStarted",
    `  (some (SpawnScenario.spawn & SpawnScenario.locked)) implies SpawnScenario.outcome = ${spawnCollisionOutcome}`,
    "  (SpawnScenario.availability = spawnOpen) iff (SpawnScenario.outcome = spawnStarted)",
    "}",
    "",
    "pred rotate {",
    "  let proposal = shape[Game.pivot, clockwise[Game.orientation]] | {",
    `    #proposal = ${model.tetromino.blockCount}`,
    "    no (proposal & Game.locked)",
    "    Game.priorActive' = Game.active",
    "    Game.priorPivot' = Game.pivot",
    "    Game.priorOrientation' = Game.orientation",
    "    Game.active' = proposal",
    "    Game.pivot' = Game.pivot",
    "    Game.orientation' = clockwise[Game.orientation]",
    "    Game.locked' = Game.locked",
    "    Game.requested' = proposal",
    "    Game.action' = rotation",
    "    Game.outcome' = accepted",
    "  }",
    "}",
    "",
    "pred rejectRotation {",
    "  let proposal = shape[Game.pivot, clockwise[Game.orientation]] | {",
    `    #proposal != ${model.tetromino.blockCount} or some (proposal & Game.locked)`,
    "    Game.priorActive' = Game.active",
    "    Game.priorPivot' = Game.pivot",
    "    Game.priorOrientation' = Game.orientation",
    "    Game.active' = Game.active",
    "    Game.pivot' = Game.pivot",
    "    Game.orientation' = Game.orientation",
    "    Game.locked' = Game.locked",
    "    Game.requested' = proposal",
    "    Game.action' = rotation",
    "    Game.outcome' = rejected",
    "  }",
    "}",
    "",
    "pred acceptTranslateLeft {",
    "  let proposal = translateLeft[Game.active] | {",
    `    #proposal = ${model.tetromino.blockCount}`,
    "    no (proposal & Game.locked)",
    "    Game.priorActive' = Game.active",
    "    Game.priorPivot' = Game.pivot",
    "    Game.priorOrientation' = Game.orientation",
    "    Game.active' = proposal",
    "    Game.pivot' = translateLeft[Game.pivot]",
    "    Game.orientation' = Game.orientation",
    "    Game.locked' = Game.locked",
    "    Game.requested' = proposal",
    "    Game.action' = translationLeft",
    "    Game.outcome' = accepted",
    "  }",
    "}",
    "",
    "pred rejectTranslateLeft {",
    "  let proposal = translateLeft[Game.active] | {",
    `    #proposal != ${model.tetromino.blockCount} or some (proposal & Game.locked)`,
    "    Game.priorActive' = Game.active",
    "    Game.priorPivot' = Game.pivot",
    "    Game.priorOrientation' = Game.orientation",
    "    Game.active' = Game.active",
    "    Game.pivot' = Game.pivot",
    "    Game.orientation' = Game.orientation",
    "    Game.locked' = Game.locked",
    "    Game.requested' = proposal",
    "    Game.action' = translationLeft",
    "    Game.outcome' = rejected",
    "  }",
    "}",
    "",
    "pred stutter {",
    "  Game.priorActive' = Game.active",
    "  Game.priorPivot' = Game.pivot",
    "  Game.priorOrientation' = Game.orientation",
    "  Game.active' = Game.active",
    "  Game.pivot' = Game.pivot",
    "  Game.orientation' = Game.orientation",
    "  Game.locked' = Game.locked",
    "  no Game.requested'",
    "  Game.action' = idleAction",
    "  Game.outcome' = idleOutcome",
    "}",
    "",
    "fact Transitions {",
    "  always (rotate or rejectRotation or acceptTranslateLeft or rejectTranslateLeft or stutter)",
    "}",
    "",
    "fact Occupancy {",
    `  always (#Game.active = ${model.tetromino.blockCount} and #Game.locked = ${model.board.initialLockedCells})`,
    "  always (Game.active + Game.locked in Board.cells)",
    "  always no (Game.active & Game.locked)",
    "  always (Game.active = shape[Game.pivot, Game.orientation])",
    "}",
  ];
  for (const check of model.checks) {
    lines.push("", ...assertionSource(check), "", `check ${assertionName(check.kind)} ${scopeClause(model, check)}`);
  }
  return {
    model,
    alloySource: `${lines.join("\n")}\n`,
  };
}

/**
 * Compiles a declared load-bearing mutation without exposing textual Alloy
 * patches to callers. The original assertion remains unchanged, so Alloy must
 * find a counterexample when the mutated transition violates it.
 */
export function compileTetrisAlloyMutation(document, mutationId) {
  const errors = validateTetrisAlloyModel(document);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  const mutation = TETRIS_ALLOY_MUTATIONS.find((candidate) => candidate.id === mutationId);
  if (!mutation) throw new Error(`unknown Tetris Alloy mutation: ${mutationId}`);
  const baseline = compileTetrisAlloyModel(document);
  const check = baseline.model.checks.find((candidate) => candidate.kind === mutation.checkKind);
  if (!check) throw new Error(`Tetris Alloy mutation ${mutationId} requires check kind: ${mutation.checkKind}`);
  const compiled = compileTetrisAlloyModel(document, { spawnCollisionOutcome: mutation.spawnCollisionOutcome });
  return {
    id: mutation.id,
    description: mutation.description,
    check: { id: check.id, kind: check.kind, expectation: check.expectation },
    alloySource: compiled.alloySource,
  };
}

function sameCell(left, right) {
  return left[0] === right[0] && left[1] === right[1];
}

function includesCell(cells, cell) {
  return cells.some((candidate) => sameCell(candidate, cell));
}

function sortCells(cells) {
  return cells.slice().sort((left, right) => left[1] - right[1] || left[0] - right[0]);
}

function insideBoard(model, [x, y]) {
  return x >= 0 && x < model.board.width && y >= 0 && y < model.board.height;
}

function shapeAt([x, y], orientation) {
  const offsets = {
    north: [[-1, 0], [0, 0], [1, 0], [0, 1]],
    east: [[0, -1], [0, 0], [0, 1], [-1, 0]],
    south: [[-1, 0], [0, 0], [1, 0], [0, -1]],
    west: [[0, -1], [0, 0], [0, 1], [1, 0]],
  };
  return offsets[orientation].map(([offsetX, offsetY]) => [x + offsetX, y + offsetY]);
}

function clockwise(orientation) {
  return ORIENTATIONS[(ORIENTATIONS.indexOf(orientation) + 1) % ORIENTATIONS.length];
}

function boardCells(model) {
  return Array.from({ length: model.board.height }, (_, y) => Array.from(
    { length: model.board.width },
    (_, x) => [x, y],
  )).flat();
}

function spawnCells(model) {
  return shapeAt([1, model.board.height - 2], "north");
}

function combinations(values, count, start = 0, prefix = []) {
  if (prefix.length === count) return [prefix];
  const result = [];
  for (let index = start; index <= values.length - (count - prefix.length); index += 1) {
    result.push(...combinations(values, count, index + 1, [...prefix, values[index]]));
  }
  return result;
}

function moveLeft(cells, model) {
  return cells.map(([x, y]) => [x - 1, y]).filter((cell) => insideBoard(model, cell));
}

function sameCells(left, right) {
  const normalizedLeft = sortCells(left);
  const normalizedRight = sortCells(right);
  return normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((cell, index) => sameCell(cell, normalizedRight[index]));
}

function rotateState(state, model) {
  const requested = shapeAt(state.pivot, clockwise(state.orientation)).filter((cell) => insideBoard(model, cell));
  const rejected = requested.length !== model.tetromino.blockCount || requested.some((cell) => includesCell(state.locked, cell));
  return rejected
    ? { active: state.active, pivot: state.pivot, orientation: state.orientation, requested, outcome: "rejected" }
    : { active: requested, pivot: state.pivot, orientation: clockwise(state.orientation), requested, outcome: "accepted" };
}

function translateLeftState(state, model) {
  const requested = moveLeft(state.active, model);
  const rejected = requested.length !== model.tetromino.blockCount || requested.some((cell) => includesCell(state.locked, cell));
  return rejected
    ? { active: state.active, pivot: state.pivot, orientation: state.orientation, requested, outcome: "rejected" }
    : { active: requested, pivot: [state.pivot[0] - 1, state.pivot[1]], orientation: state.orientation, requested, outcome: "accepted" };
}

function rejectedRotationWitness(model) {
  const pivot = [1, 1];
  const active = shapeAt(pivot, "north");
  const requested = shapeAt(pivot, "east").filter((cell) => insideBoard(model, cell));
  const locked = [[1, 0]];
  return {
    trace: [
      { active: sortCells(active), locked, requested: [], outcome: "idle" },
      { active: sortCells(active), locked, requested: sortCells(requested), outcome: "rejected" },
    ],
    reason: "the rotated T piece would overlap the locked cell at (1, 0), so active coordinates remain unchanged",
  };
}

function rejectedTranslationWitness(model) {
  const active = shapeAt([1, 1], "north");
  const requested = moveLeft(active, model);
  const locked = [[3, 3]];
  return {
    trace: [
      { active: sortCells(active), locked, requested: [], outcome: "idle" },
      { active: sortCells(active), locked, requested: sortCells(requested), outcome: "rejected" },
    ],
    reason: "moving left drops one cell outside the board, so active coordinates remain unchanged",
  };
}

function coordinateCases(model) {
  const cells = boardCells(model);
  const results = {
    states: 0,
    rotations: 0,
    translations: 0,
    validTranslations: 0,
    validRotations: 0,
    boundsHolds: true,
    disjointHolds: true,
    rotationHolds: true,
    translationHolds: true,
  };
  for (const orientation of ORIENTATIONS) {
    for (const pivot of cells) {
      const active = shapeAt(pivot, orientation);
      if (active.length !== model.tetromino.blockCount || !active.every((cell) => insideBoard(model, cell))) continue;
      const availableLocked = cells.filter((cell) => !includesCell(active, cell));
      for (const locked of combinations(availableLocked, model.board.initialLockedCells)) {
        results.states += 1;
        const state = { active, pivot, orientation, locked };
        results.boundsHolds &&= active.every((cell) => insideBoard(model, cell)) && locked.every((cell) => insideBoard(model, cell));
        results.disjointHolds &&= !active.some((cell) => includesCell(locked, cell));

        const rotation = rotateState(state, model);
        const rotationRejected = rotation.requested.length !== model.tetromino.blockCount
          || rotation.requested.some((cell) => includesCell(locked, cell));
        if (rotationRejected) {
          results.rotations += 1;
          results.rotationHolds &&= rotation.outcome === "rejected"
            && sameCells(rotation.active, active)
            && sameCell(rotation.pivot, pivot)
            && rotation.orientation === orientation;
        } else {
          results.validRotations += 1;
          results.rotationHolds &&= rotation.outcome === "accepted"
            && sameCells(rotation.active, rotation.requested)
            && rotation.orientation === clockwise(orientation);
        }

        const translation = translateLeftState(state, model);
        const translationRejected = translation.requested.length !== model.tetromino.blockCount
          || translation.requested.some((cell) => includesCell(locked, cell));
        if (translationRejected) {
          results.translations += 1;
          results.translationHolds &&= translation.outcome === "rejected"
            && sameCells(translation.active, active)
            && sameCell(translation.pivot, pivot)
            && translation.orientation === orientation;
        } else {
          results.validTranslations += 1;
          results.translationHolds &&= translation.outcome === "accepted"
            && sameCells(translation.active, translation.requested)
            && sameCell(translation.pivot, [pivot[0] - 1, pivot[1]])
            && translation.orientation === orientation;
        }
      }
    }
  }
  return results;
}

function coordinateSpawnCases(model) {
  const spawn = sortCells(spawnCells(model));
  const lockedSets = combinations(boardCells(model), model.board.initialLockedCells);
  const results = {
    cases: lockedSets.length,
    clearHolds: true,
    blockedHolds: true,
    availabilityHolds: true,
    clearWitness: null,
    blockedWitness: null,
    availabilityWitness: null,
  };
  for (const locked of lockedSets) {
    const sortedLocked = sortCells(locked);
    const blocked = sortedLocked.some((cell) => includesCell(spawn, cell));
    const outcome = blocked ? "game-over" : "started";
    const spawnOpen = blocked ? 0 : 1;
    results.availabilityHolds &&= (spawnOpen === 1) === !blocked;
    results.availabilityWitness ??= { locked: sortedLocked, outcome, spawn, spawnOpen };
    if (blocked) {
      results.blockedHolds &&= outcome === "game-over";
      results.blockedWitness ??= { locked: sortedLocked, outcome, spawn };
    } else {
      results.clearHolds &&= outcome === "started" && sameCells(spawn, spawnCells(model));
      results.clearWitness ??= { locked: sortedLocked, outcome, spawn };
    }
  }
  return results;
}

function localGroundingPath(projectRoot, source) {
  const path = resolve(projectRoot, source ?? "");
  const fromRoot = relative(projectRoot, path);
  return fromRoot === "" || (!fromRoot.startsWith(`..${sep}`) && fromRoot !== ".." && !fromRoot.startsWith(".."))
    ? path
    : null;
}

function spawnAvailabilityResult(value) {
  if (!record(value) || (value.spawnOpen !== 0 && value.spawnOpen !== 1)) {
    throw new Error("spawn availability adapter must return { spawnOpen: 0 | 1 }");
  }
  return { spawnOpen: value.spawnOpen };
}

/**
 * Compare a pure spawn-availability adapter with every selected concrete
 * locked-cell position. This grounds the coordinate-to-input abstraction in
 * code, but remains finite conformance evidence rather than a proof about an
 * arbitrary board, tetromino, or production process.
 */
export async function verifyTetrisAlloyImplementation(document, { projectRoot = process.cwd() } = {}) {
  const errors = validateTetrisAlloyModel(document);
  if (errors.length > 0) {
    return {
      tetrisAlloy: document?.tetrisAlloy?.id ?? null,
      status: "fail",
      assurance: "finite-coordinate-conformance",
      check: null,
      checkedCases: 0,
      cases: [],
      counterexample: null,
      errors,
    };
  }
  const model = normalizedModel(document);
  const grounding = model.spawnAvailabilityGrounding;
  if (!grounding) {
    return {
      tetrisAlloy: model.id,
      status: "skip",
      assurance: "finite-coordinate-conformance",
      check: null,
      checkedCases: 0,
      cases: [],
      counterexample: null,
      errors: [],
      reason: "spawn availability grounding is not declared",
    };
  }
  let adapter;
  try {
    const source = localGroundingPath(projectRoot, grounding.implementation.path);
    if (!source) throw new Error(`Tetris Alloy spawn availability grounding source escapes project root: ${grounding.implementation.path}`);
    const module = await import(pathToFileURL(source).href);
    adapter = module[grounding.implementation.symbol];
    if (typeof adapter !== "function") {
      throw new Error(`Tetris Alloy spawn availability adapter is not a function: ${grounding.implementation.symbol}`);
    }
  } catch (error) {
    return {
      tetrisAlloy: model.id,
      status: "fail",
      assurance: "finite-coordinate-conformance",
      check: grounding.check,
      checkedCases: 0,
      cases: [],
      counterexample: null,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }

  const spawn = sortCells(spawnCells(model));
  const cases = [];
  for (const locked of combinations(boardCells(model), model.board.initialLockedCells)) {
    const normalizedLocked = sortCells(locked);
    const expected = { spawnOpen: normalizedLocked.some((cell) => includesCell(spawn, cell)) ? 0 : 1 };
    let actual = null;
    let error = null;
    try {
      actual = spawnAvailabilityResult(await adapter({
        board: { width: model.board.width, height: model.board.height },
        locked: normalizedLocked.map(([x, y]) => [x, y]),
      }));
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
    cases.push({
      board: { width: model.board.width, height: model.board.height },
      locked: normalizedLocked,
      expected,
      actual,
      error,
      status: error === null && actual?.spawnOpen === expected.spawnOpen ? "pass" : "fail",
    });
  }
  const failedCase = cases.find((entry) => entry.status === "fail") ?? null;
  const counterexample = failedCase
    ? {
      board: failedCase.board,
      locked: failedCase.locked,
      expected: failedCase.expected,
      actual: failedCase.actual,
      error: failedCase.error,
    }
    : null;
  return {
    tetrisAlloy: model.id,
    status: failedCase ? "fail" : "pass",
    assurance: "finite-coordinate-conformance",
    check: grounding.check,
    checkedCases: cases.length,
    cases,
    counterexample,
    errors: failedCase ? [
      failedCase.error ?? `spawn availability implementation mismatch: expected ${failedCase.expected.spawnOpen}, got ${failedCase.actual?.spawnOpen ?? "missing"}`,
    ] : [],
  };
}

function evaluateCheck(model, check, cases, spawnCases) {
  const holds = check.kind === "alwaysInBounds"
    ? cases.boundsHolds
    : check.kind === "alwaysDisjoint"
      ? cases.disjointHolds
      : check.kind === "collisionRotationRejected"
        ? cases.rotationHolds
        : check.kind === "illegalTranslationRejected"
          ? cases.translationHolds
          : check.kind === "clearSpawnStartsGame"
            ? spawnCases.clearHolds && spawnCases.clearWitness !== null
            : check.kind === "blockedSpawnGameOver"
              ? spawnCases.blockedHolds && spawnCases.blockedWitness !== null
              : spawnCases.availabilityHolds && spawnCases.availabilityWitness !== null;
  const actual = holds ? "holds" : "violated";
  return {
    id: check.id,
    rule: check.rule,
    kind: check.kind,
    expectation: check.expectation,
    maxSteps: check.maxSteps,
    assurance: "bounded-relational-reference",
    status: actual === check.expectation ? "pass" : "fail",
    checkedCases: check.kind === "clearSpawnStartsGame" || check.kind === "blockedSpawnGameOver" || check.kind === "spawnAvailabilityRefinesCoordinates" ? spawnCases.cases : cases.states,
    witness: check.kind === "collisionRotationRejected"
      ? rejectedRotationWitness(model)
      : check.kind === "illegalTranslationRejected"
        ? rejectedTranslationWitness(model)
        : check.kind === "clearSpawnStartsGame"
          ? spawnCases.clearWitness
          : check.kind === "blockedSpawnGameOver"
            ? spawnCases.blockedWitness
            : check.kind === "spawnAvailabilityRefinesCoordinates"
              ? spawnCases.availabilityWitness
        : null,
  };
}

/** Evaluate the finite relational reference model and retain a positive rejected-rotation trace. */
export function verifyTetrisAlloyModel(document) {
  const errors = validateTetrisAlloyModel(document);
  if (errors.length > 0) {
    return {
      schemaVersion: TETRIS_ALLOY_MODEL_SCHEMA_VERSION,
      model: { id: document?.model?.id ?? null, version: document?.model?.version ?? null },
      tetrisAlloy: document?.tetrisAlloy?.id ?? null,
      status: "fail",
      alloySource: null,
      checks: [],
      errors,
    };
  }
  const compiled = compileTetrisAlloyModel(document);
  const cases = coordinateCases(compiled.model);
  const spawnCases = coordinateSpawnCases(compiled.model);
  const checks = compiled.model.checks.map((check) => evaluateCheck(compiled.model, check, cases, spawnCases));
  const failures = checks.filter((check) => check.status === "fail");
  return {
    schemaVersion: TETRIS_ALLOY_MODEL_SCHEMA_VERSION,
    model: { id: document?.model?.id ?? null, version: document?.model?.version ?? null },
    tetrisAlloy: compiled.model.id,
    status: failures.length === 0 ? "pass" : "fail",
    alloySource: compiled.alloySource,
    checks,
    errors: failures.map((check) => `Tetris Alloy check failed: ${check.id}`),
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

function analyzerCheck(command, sourcePath, directory, name) {
  const output = join(directory, name);
  const result = spawnSync(command, ["exec", "-q", "-t", "json", "-o", output, "-f", "-c", name, sourcePath], { encoding: "utf8" });
  const parsed = readReceipt(join(output, "receipt.json"));
  const succeeded = result.status === 0 && !parsed.error;
  const solution = parsed.receipt?.commands?.[name]?.solution;
  return {
    succeeded,
    receipt: parsed.receipt,
    counterexample: succeeded && Array.isArray(solution) && solution.length > 0 ? solution[0] : null,
    error: succeeded ? null : (parsed.error ?? result.stderr ?? result.stdout ?? `alloy6 exited ${result.status}`),
  };
}

function coordinateOf(values, atom) {
  const cell = values?.[atom] ?? {};
  const column = cell.column?.[0]?.[0];
  const row = cell.row?.[0]?.[0];
  const columnMatch = /^Column\$(\d+)$/.exec(column ?? "");
  const rowMatch = /^Row\$(\d+)$/.exec(row ?? "");
  return columnMatch && rowMatch ? [Number(columnMatch[1]), Number(rowMatch[1])] : null;
}

function unaryAtoms(relation) {
  return list(relation).map((tuple) => tuple?.[0]).filter((atom) => typeof atom === "string");
}

/** Translate the Alloy atom receipt for the spawn scenario to board coordinates. */
function renderSpawnCounterexample(counterexample) {
  const values = counterexample?.instances?.[0]?.values;
  if (!values || typeof values !== "object") return null;
  const scenario = Object.entries(values).find(([atom]) => atom.startsWith("SpawnScenario$"))?.[1];
  if (!scenario || typeof scenario !== "object") return null;
  const outcomeAtom = unaryAtoms(scenario.outcome)[0] ?? "";
  const outcome = outcomeAtom.startsWith("spawnStarted$")
    ? "started"
    : outcomeAtom.startsWith("spawnGameOver$")
      ? "game-over"
      : null;
  const availabilityAtom = unaryAtoms(scenario.availability)[0] ?? "";
  const spawnOpen = availabilityAtom.startsWith("spawnOpen$")
    ? 1
    : availabilityAtom.startsWith("spawnBlocked$")
      ? 0
      : null;
  const coordinates = (relation) => unaryAtoms(relation)
    .map((atom) => coordinateOf(values, atom))
    .filter(Boolean)
    .sort((left, right) => left[1] - right[1] || left[0] - right[0]);
  return {
    locked: coordinates(scenario.locked),
    spawn: coordinates(scenario.spawn),
    outcome,
    spawnOpen,
  };
}

/**
 * Runs the Tetris mutation suite through Alloy 6. A mutation passes only when
 * its original domain assertion receives a solver counterexample.
 */
export function verifyTetrisAlloyMutationWithAnalyzer(document, { command = "alloy6" } = {}) {
  const errors = validateTetrisAlloyModel(document);
  if (errors.length > 0) return { status: "fail", mutations: [], errors };
  if (!commandExists(command)) return { status: "skip", mutations: [], errors: [], reason: "alloy6 not found on PATH" };
  const directory = mkdtempSync(join(tmpdir(), "dspec-tetris-alloy-mutation-"));
  try {
    const mutations = TETRIS_ALLOY_MUTATIONS.map((mutation) => {
      const compiled = compileTetrisAlloyMutation(document, mutation.id);
      const sourcePath = join(directory, `${mutation.id}.als`);
      writeFileSync(sourcePath, compiled.alloySource, "utf8");
      const commandName = assertionName(compiled.check.kind);
      const result = analyzerCheck(command, sourcePath, directory, commandName);
      const actual = result.succeeded ? (result.counterexample ? "violated" : "holds") : null;
      return {
        id: compiled.id,
        description: compiled.description,
        check: compiled.check.id,
        command: commandName,
        actual,
        assurance: "alloy6-mutation",
        status: result.succeeded && actual === "violated" ? "detected" : "missed",
        counterexample: renderSpawnCounterexample(result.counterexample),
        error: result.succeeded
          ? (actual === "violated" ? null : `Alloy mutation ${compiled.id} produced no counterexample`)
          : result.error,
      };
    });
    const failures = mutations.filter((mutation) => mutation.status !== "detected");
    return {
      status: failures.length === 0 ? "pass" : "fail",
      mutations,
      errors: failures.map((mutation) => `Alloy mutation was not detected: ${mutation.id}`),
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/**
 * Executes the generated source with Alloy 6 when installed. A returned
 * `skip` does not upgrade the reference result; it merely says that this
 * machine has no Alloy analyzer available.
 */
export function verifyTetrisAlloyWithAnalyzer(document, { command = "alloy6" } = {}) {
  const errors = validateTetrisAlloyModel(document);
  if (errors.length > 0) return { status: "fail", checks: [], errors };
  if (!commandExists(command)) {
    return { status: "skip", checks: [], errors: [], reason: "alloy6 not found on PATH" };
  }
  const compiled = compileTetrisAlloyModel(document);
  const directory = mkdtempSync(join(tmpdir(), "dspec-tetris-alloy-"));
  try {
    const sourcePath = join(directory, "model.als");
    writeFileSync(sourcePath, compiled.alloySource, "utf8");
    const checks = compiled.model.checks.map((check) => {
      const commandName = assertionName(check.kind);
      const result = analyzerCheck(command, sourcePath, directory, commandName);
      const actual = result.counterexample ? "violated" : "holds";
      const status = result.succeeded && actual === check.expectation ? "pass" : "fail";
      return {
        id: check.id,
        command: commandName,
        expectation: check.expectation,
        actual: result.succeeded ? actual : null,
        assurance: "alloy6-bounded",
        status,
        counterexample: result.counterexample,
        receipt: result.receipt,
        error: result.succeeded
          ? (status === "pass" ? null : `Alloy check ${check.id} expected ${check.expectation}, but found ${actual}`)
          : result.error,
      };
    });
    const failures = checks.filter((check) => check.status === "fail");
    return {
      status: failures.length === 0 ? "pass" : "fail",
      checks,
      errors: failures.map((check) => `Alloy analyzer failed: ${check.id}`),
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
