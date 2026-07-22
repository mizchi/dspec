import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

export const ALLOY_BEHAVIOR_MODEL_SCHEMA_VERSION = "1.0";

const CHECK_KINDS = ["alwaysExclusive", "alwaysOwnerCapacity", "eventuallyReleased"];
const RESERVATION_SCHEDULING = ["unconstrained", "releaseBeforeReserve"];
const MAX_SCOPE_MATRIX_CELLS = 128;

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
  return ids;
}

function pascalCase(value) {
  const words = String(value ?? "").split(/[^A-Za-z0-9]+/).filter(Boolean);
  const result = words.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join("");
  return result || "Unnamed";
}

function moduleName(value) {
  const result = String(value ?? "").replace(/[^A-Za-z0-9_]/g, "_");
  return /^[A-Za-z_]/.test(result) ? result : `Model_${result}`;
}

function assertionName(kind) {
  if (kind === "alwaysExclusive") return "ReservationExclusive";
  if (kind === "alwaysOwnerCapacity") return "ReservationOwnerCapacity";
  if (kind === "eventuallyReleased") return "ReservationEventuallyReleased";
  throw new Error(`unknown relational temporal check: ${kind}`);
}

function normalizedModel(document) {
  const behavior = record(document?.alloyBehavior);
  if (!behavior) throw new Error("alloy behavior specification is required");
  return {
    id: behavior.id ?? null,
    terms: list(behavior.terms),
    entities: list(behavior.entities).map((entity) => ({
      id: entity?.id ?? null,
      scope: entity?.scope ?? null,
    })),
    reservation: {
      id: behavior.reservation?.id ?? null,
      owner: behavior.reservation?.owner ?? null,
      resource: behavior.reservation?.resource ?? null,
      scheduling: behavior.reservation?.scheduling ?? "unconstrained",
    },
    checks: list(behavior.checks).map((check) => ({
      id: check?.id ?? null,
      rule: check?.rule ?? null,
      kind: check?.kind ?? null,
      expectation: check?.expectation ?? null,
      maxSteps: check?.maxSteps ?? null,
    })),
  };
}

function domainReferences(document, model, errors) {
  const vocabulary = new Set(list(document?.model?.vocabulary).map((term) => term?.id).filter(Boolean));
  const rules = new Set(list(document?.model?.rules).map((rule) => rule?.id).filter(Boolean));
  for (const term of model.terms) {
    if (!vocabulary.has(term)) errors.push(`alloy behavior references unknown domain term: ${term ?? "missing"}`);
  }
  for (const check of model.checks) {
    if (!rules.has(check.rule)) {
      errors.push(`alloy behavior references unknown domain rule: ${check.id ?? "missing"} -> ${check.rule ?? "missing"}`);
    }
  }
}

/** Validate the narrow relational-temporal model before rendering Alloy. */
export function validateAlloyBehaviorModel(document) {
  const errors = [];
  let model;
  try {
    model = normalizedModel(document);
  } catch (error) {
    return [error.message];
  }
  if (!model.id) errors.push("alloy behavior id is required");
  const entityIds = duplicateIds(model.entities, "alloy behavior entity", errors);
  duplicateIds(model.checks, "alloy behavior check", errors);
  const kinds = new Set();
  for (const entity of model.entities) {
    if (!Number.isInteger(entity.scope) || entity.scope < 1) {
      errors.push(`alloy behavior entity scope must be a positive integer: ${entity.id ?? "missing"}`);
    }
  }
  const renderedEntities = model.entities.map((entity) => pascalCase(entity.id));
  if (new Set(renderedEntities).size !== renderedEntities.length) {
    errors.push("alloy behavior entity ids must render to distinct Alloy names");
  }
  if (renderedEntities.includes("ReservationState")) {
    errors.push("alloy behavior entity id is reserved: ReservationState");
  }
  if (!model.reservation.id) errors.push("alloy behavior reservation id is required");
  if (!entityIds.has(model.reservation.owner)) {
    errors.push(`alloy behavior reservation references unknown owner entity: ${model.reservation.owner ?? "missing"}`);
  }
  if (!entityIds.has(model.reservation.resource)) {
    errors.push(`alloy behavior reservation references unknown resource entity: ${model.reservation.resource ?? "missing"}`);
  }
  if (model.reservation.owner && model.reservation.owner === model.reservation.resource) {
    errors.push("alloy behavior reservation owner and resource must be different entities");
  }
  if (!RESERVATION_SCHEDULING.includes(model.reservation.scheduling)) {
    errors.push(`unknown alloy behavior reservation scheduling: ${model.reservation.scheduling ?? "missing"}`);
  }
  for (const check of model.checks) {
    if (!CHECK_KINDS.includes(check.kind)) {
      errors.push(`unknown alloy behavior temporal check kind: ${check.kind ?? "missing"}`);
    } else if (kinds.has(check.kind)) {
      errors.push(`duplicate alloy behavior temporal check kind: ${check.kind}`);
    } else {
      kinds.add(check.kind);
    }
    if (check.expectation !== "holds" && check.expectation !== "violated") {
      errors.push(`alloy behavior check expectation must be holds or violated: ${check.id ?? "missing"}`);
    }
    if (!Number.isInteger(check.maxSteps) || check.maxSteps < 1) {
      errors.push(`alloy behavior check maxSteps must be a positive integer: ${check.id ?? "missing"}`);
    }
  }
  domainReferences(document, model, errors);
  return errors;
}

function scopeClause(model, check) {
  const entities = model.entities.map((entity) => `exactly ${entity.scope} ${pascalCase(entity.id)}`);
  return `for ${entities.join(", ")}, ${check.maxSteps} steps`;
}

function runSteps(model) {
  return Math.max(2, ...model.checks.map((check) => check.maxSteps));
}

function sanityCommands(model) {
  const steps = runSteps(model);
  return [
    { id: "world", command: "ReservationWorld", maxSteps: steps },
    { id: "reserve", command: "ReservationCanBeReserved", maxSteps: steps },
    { id: "release", command: "ReservationCanBeReleased", maxSteps: steps },
  ];
}

function sanitySource(model, ownerName, resourceName) {
  const commands = sanityCommands(model);
  return [
    "pred ReservationWorld {",
    `  some ${ownerName}`,
    `  some ${resourceName}`,
    "}",
    "",
    "pred ReservationCanBeReserved {",
    "  eventually some ReservationState.owner",
    "}",
    "",
    "pred ReservationCanBeReleased {",
    "  eventually (some ReservationState.owner and after no ReservationState.owner)",
    "}",
    "",
    ...commands.flatMap((command) => [
      `run ${command.command} ${scopeClause(model, command)}`,
      "",
    ]),
  ];
}

function assertionSource(check, ownerName, resourceName) {
  const name = assertionName(check.kind);
  if (check.kind === "alwaysExclusive") {
    return [
      `assert ${name} {`,
      `  always (all p: ${resourceName} | lone p.(ReservationState.owner))`,
      "}",
    ];
  }
  if (check.kind === "alwaysOwnerCapacity") {
    return [
      `assert ${name} {`,
      `  always (all c: ${ownerName} | lone c.~(ReservationState.owner))`,
      "}",
    ];
  }
  return [
    `assert ${name} {`,
    `  always (all p: ${resourceName} |`,
    "    (some p.(ReservationState.owner) implies eventually no p.(ReservationState.owner)))",
    "}",
  ];
}

function transitionSource(model, ownerName, resourceName) {
  if (model.reservation.scheduling === "releaseBeforeReserve") {
    return [
      "fact Transitions {",
      "  always (",
      "    some ReservationState.owner =>",
      `      (some c: ${ownerName}, p: ${resourceName} | release[c, p]) else`,
      `      ((some c: ${ownerName}, p: ${resourceName} | reserve[c, p]) or stutter)`,
      "  )",
      "}",
    ];
  }
  return [
    "fact Transitions {",
    "  always (",
    `    (some c: ${ownerName}, p: ${resourceName} | reserve[c, p]) or`,
    `    (some c: ${ownerName}, p: ${resourceName} | release[c, p]) or`,
    "    stutter",
    "  )",
    "}",
  ];
}

/** Deterministically lower the closed relational vocabulary to Alloy 6. */
export function compileAlloyBehaviorModel(document) {
  const model = normalizedModel(document);
  const entityById = new Map(model.entities.map((entity) => [entity.id, entity]));
  const ownerName = pascalCase(entityById.get(model.reservation.owner)?.id);
  const resourceName = pascalCase(entityById.get(model.reservation.resource)?.id);
  const lines = [
    `module ${moduleName(model.id)}`,
    "",
    ...model.entities.map((entity) => `sig ${pascalCase(entity.id)} {}`),
    "",
    "one sig ReservationState {",
    `  var owner: ${resourceName} -> lone ${ownerName}`,
    "}",
    "",
    "fact Initial {",
    "  no ReservationState.owner",
    "}",
    "",
    `pred reserve[c: ${ownerName}, p: ${resourceName}] {`,
    "  no p.(ReservationState.owner)",
    "  ReservationState.owner' = ReservationState.owner + p->c",
    "}",
    "",
    `pred release[c: ${ownerName}, p: ${resourceName}] {`,
    "  p->c in ReservationState.owner",
    "  ReservationState.owner' = ReservationState.owner - p->c",
    "}",
    "",
    "pred stutter {",
    "  ReservationState.owner' = ReservationState.owner",
    "}",
    "",
    ...transitionSource(model, ownerName, resourceName),
    "",
    ...sanitySource(model, ownerName, resourceName),
  ];
  for (const check of model.checks) {
    lines.push("", ...assertionSource(check, ownerName, resourceName), "", `check ${assertionName(check.kind)} ${scopeClause(model, check)}`);
  }
  return {
    model: {
      id: model.id,
      entities: model.entities,
      reservation: model.reservation,
      checks: model.checks,
      sanity: sanityCommands(model),
    },
    alloySource: `${lines.join("\n")}\n`,
  };
}

function initialState(resourceCount) {
  return Array.from({ length: resourceCount }, () => null);
}

function reservationState(state, resourceId, ownerId) {
  return state.flatMap((owner, resourceIndex) => owner === null
    ? []
    : [{ resource: `${resourceId}#${resourceIndex}`, owner: `${ownerId}#${owner}` }]);
}

function renderTrace(states, model) {
  return states.map((state) => ({
    reservation: reservationState(state, model.reservation.resource, model.reservation.owner),
  }));
}

function livenessWitness(model, check) {
  const ownerScope = model.entities.find((entity) => entity.id === model.reservation.owner).scope;
  const resourceScope = model.entities.find((entity) => entity.id === model.reservation.resource).scope;
  if (ownerScope < 1 || resourceScope < 1) return null;
  const held = initialState(resourceScope);
  held[0] = 0;
  const states = [initialState(resourceScope), ...Array.from({ length: check.maxSteps }, () => [...held])];
  return {
    trace: renderTrace(states, model),
    violation: { resource: `${model.reservation.resource}#0`, index: 1 },
  };
}

function ownerCapacityWitness(model, check) {
  const ownerScope = model.entities.find((entity) => entity.id === model.reservation.owner).scope;
  const resourceScope = model.entities.find((entity) => entity.id === model.reservation.resource).scope;
  if (ownerScope < 1 || resourceScope < 2) return null;
  const oneReservation = initialState(resourceScope);
  oneReservation[0] = 0;
  const twoReservations = [...oneReservation];
  twoReservations[1] = 0;
  const states = [
    initialState(resourceScope),
    oneReservation,
    ...Array.from({ length: Math.max(1, check.maxSteps - 1) }, () => [...twoReservations]),
  ];
  return {
    trace: renderTrace(states, model),
    violation: { owner: `${model.reservation.owner}#0`, index: 2 },
  };
}

function evaluateCheck(model, check) {
  const actualHolds = check.kind === "alwaysExclusive"
    || (check.kind === "eventuallyReleased" && model.reservation.scheduling === "releaseBeforeReserve")
    || (check.kind === "alwaysOwnerCapacity" && model.reservation.scheduling === "releaseBeforeReserve");
  const witness = actualHolds
    ? null
    : check.kind === "alwaysOwnerCapacity"
      ? ownerCapacityWitness(model, check)
      : livenessWitness(model, check);
  const expectedHolds = check.expectation === "holds";
  return {
    id: check.id,
    rule: check.rule,
    kind: check.kind,
    expectation: check.expectation,
    maxSteps: check.maxSteps,
    assurance: "bounded-relational-reference",
    status: actualHolds === expectedHolds ? "pass" : "fail",
    witness,
  };
}

function errorReport(document, errors) {
  return {
    schemaVersion: ALLOY_BEHAVIOR_MODEL_SCHEMA_VERSION,
    model: { id: document?.model?.id ?? null, version: document?.model?.version ?? null },
    alloyBehavior: document?.alloyBehavior?.id ?? null,
    status: "fail",
    alloySource: null,
    checks: [],
    errors,
  };
}

/**
 * Evaluate the finite reference semantics and preserve an intended liveness
 * counterexample. This is explicitly not an unbounded theorem nor an
 * implementation-refinement result.
 */
export function verifyAlloyBehaviorModel(document) {
  const errors = validateAlloyBehaviorModel(document);
  if (errors.length > 0) return errorReport(document, errors);
  const compiled = compileAlloyBehaviorModel(document);
  const checks = compiled.model.checks.map((check) => evaluateCheck(compiled.model, check));
  const failures = checks.filter((check) => check.status === "fail").map((check) => `alloy behavior check failed: ${check.id}`);
  return {
    schemaVersion: ALLOY_BEHAVIOR_MODEL_SCHEMA_VERSION,
    model: { id: document?.model?.id ?? null, version: document?.model?.version ?? null },
    alloyBehavior: compiled.model.id,
    status: failures.length === 0 ? "pass" : "fail",
    alloySource: compiled.alloySource,
    checks,
    errors: failures,
  };
}

function commandExists(command) {
  return spawnSync(command, ["version"], { encoding: "utf8" }).status === 0;
}

function receiptCounterexample(receipt, command) {
  const solution = receipt?.commands?.[command]?.solution;
  return Array.isArray(solution) && solution.length > 0 ? solution[0] : null;
}

function displayAtom(atom, alloyEntity, domainEntity) {
  const prefix = `${alloyEntity}$`;
  return typeof atom === "string" && atom.startsWith(prefix)
    ? `${domainEntity}#${atom.slice(prefix.length)}`
    : atom;
}

function renderAnalyzerCounterexample(counterexample, model) {
  if (!counterexample) return null;
  const ownerEntity = model.entities.find((entity) => entity.id === model.reservation.owner);
  const resourceEntity = model.entities.find((entity) => entity.id === model.reservation.resource);
  const ownerName = pascalCase(ownerEntity.id);
  const resourceName = pascalCase(resourceEntity.id);
  const trace = list(counterexample.instances).map((instance) => {
    const values = record(instance?.values) ?? {};
    const reservationState = Object.entries(values).find(([atom]) => atom.startsWith("ReservationState$"))?.[1];
    const pairs = list(reservationState?.owner).map((pair) => ({
      resource: displayAtom(pair?.[0], resourceName, resourceEntity.id),
      owner: displayAtom(pair?.[1], ownerName, ownerEntity.id),
    }));
    return { reservation: pairs };
  });
  return { trace };
}

function readAnalyzerReceipt(path) {
  if (!existsSync(path)) return { receipt: null, receiptError: null };
  try {
    return { receipt: JSON.parse(readFileSync(path, "utf8")), receiptError: null };
  } catch (error) {
    return { receipt: null, receiptError: `cannot parse Alloy receipt: ${error.message}` };
  }
}

function executeAlloyCommand(command, sourcePath, directory, commandName, outputName = commandName) {
  const output = join(directory, outputName);
  const result = spawnSync(command, ["exec", "-q", "-t", "json", "-o", output, "-f", "-c", commandName, sourcePath], { encoding: "utf8" });
  const { receipt, receiptError } = readAnalyzerReceipt(join(output, "receipt.json"));
  const executionPassed = result.status === 0 && !receiptError;
  return {
    executionPassed,
    receipt,
    counterexample: executionPassed ? receiptCounterexample(receipt, commandName) : null,
    error: executionPassed ? null : (receiptError ?? result.stderr ?? result.stdout ?? `alloy6 exited ${result.status}`),
  };
}

/**
 * Ask Alloy 6 to execute every generated check. A check result is interpreted
 * from Alloy's receipt: a `solution` for `check P` is a counterexample to P.
 * The receipt is retained as tool evidence, and its witness is reduced to the
 * DSL's reservation vocabulary for review.
 */
export function verifyAlloyBehaviorWithAnalyzer(document, { command = "alloy6" } = {}) {
  const errors = validateAlloyBehaviorModel(document);
  if (errors.length > 0) return { status: "fail", checks: [], errors };
  if (!commandExists(command)) {
    return { status: "skip", checks: [], errors: [], reason: "alloy6 not found on PATH" };
  }
  const compiled = compileAlloyBehaviorModel(document);
  const directory = mkdtempSync(join(tmpdir(), "dspec-alloy-behavior-"));
  try {
    const sourcePath = join(directory, "model.als");
    writeFileSync(sourcePath, compiled.alloySource, "utf8");
    const checks = compiled.model.checks.map((check) => {
      const name = assertionName(check.kind);
      const execution = executeAlloyCommand(command, sourcePath, directory, name);
      const counterexample = execution.counterexample;
      const actual = counterexample ? "violated" : "holds";
      const expectationMatches = actual === check.expectation;
      const error = !execution.executionPassed
        ? execution.error
        : expectationMatches
          ? null
          : `Alloy check ${check.id} expected ${check.expectation}, but found ${actual}`;
      return {
        id: check.id,
        command: name,
        expectation: check.expectation,
        actual: execution.executionPassed ? actual : null,
        assurance: "alloy6-bounded",
        status: execution.executionPassed && expectationMatches ? "pass" : "fail",
        counterexample: renderAnalyzerCounterexample(counterexample, compiled.model),
        receipt: execution.receipt,
        error,
      };
    });
    const sanity = compiled.model.sanity.map((definition) => {
      const execution = executeAlloyCommand(command, sourcePath, directory, definition.command);
      const reachable = Boolean(execution.counterexample);
      return {
        id: definition.id,
        command: definition.command,
        actual: execution.executionPassed ? (reachable ? "reachable" : "unreachable") : null,
        assurance: "alloy6-bounded-run",
        status: execution.executionPassed && reachable ? "pass" : "fail",
        counterexample: renderAnalyzerCounterexample(execution.counterexample, compiled.model),
        receipt: execution.receipt,
        error: execution.executionPassed && reachable
          ? null
          : execution.executionPassed
            ? `Alloy run ${definition.command} found no instance`
            : execution.error,
      };
    });
    const failed = [...checks, ...sanity].filter((check) => check.status === "fail");
    return {
      status: failed.length === 0 ? "pass" : "fail",
      checks,
      sanity,
      errors: failed.map((check) => `alloy analyzer failed: ${check.id}`),
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function integerRange(limit) {
  return Array.from({ length: limit }, (_, index) => index + 1);
}

function scopeAssignments(entities, index = 0, values = {}) {
  if (index === entities.length) return [values];
  const entity = entities[index];
  return integerRange(entity.scope).flatMap((scope) => scopeAssignments(
    entities,
    index + 1,
    { ...values, [entity.id]: scope },
  ));
}

function scopeMatrixCells(model) {
  const assignments = scopeAssignments(model.entities);
  const maxSteps = Math.max(...model.checks.map((check) => check.maxSteps));
  return assignments.flatMap((scopes) => integerRange(maxSteps).map((steps) => ({ scopes, steps })));
}

function scopedDocument(document, cell) {
  const scoped = structuredClone(document);
  for (const entity of scoped.alloyBehavior.entities) entity.scope = cell.scopes[entity.id];
  for (const check of scoped.alloyBehavior.checks) check.maxSteps = cell.steps;
  return scoped;
}

/**
 * Re-run the generated Alloy checks over every smaller exact entity scope and
 * time bound. `holds` must survive every cell. `violated` must have at least
 * one counterexample, while cells too small to express that witness are kept
 * as `not-found`, not incorrectly reported as a passing proof.
 */
export function verifyAlloyBehaviorScopeMatrix(document, { command = "alloy6", maxCells = MAX_SCOPE_MATRIX_CELLS } = {}) {
  const errors = validateAlloyBehaviorModel(document);
  if (errors.length > 0) return { status: "fail", cells: [], summary: {}, errors };
  if (!commandExists(command)) {
    return { status: "skip", cells: [], summary: {}, errors: [], reason: "alloy6 not found on PATH" };
  }
  const model = compileAlloyBehaviorModel(document).model;
  const requestedCells = scopeMatrixCells(model);
  if (requestedCells.length > maxCells) {
    return {
      status: "fail",
      cells: [],
      summary: {},
      errors: [`alloy scope matrix has ${requestedCells.length} cells; maximum is ${maxCells}`],
    };
  }
  const directory = mkdtempSync(join(tmpdir(), "dspec-alloy-scope-matrix-"));
  try {
    const cells = requestedCells.map((cell, index) => {
      const scoped = scopedDocument(document, cell);
      const compiled = compileAlloyBehaviorModel(scoped);
      const sourcePath = join(directory, `cell-${index}.als`);
      writeFileSync(sourcePath, compiled.alloySource, "utf8");
      const checks = compiled.model.checks.map((check) => {
        const commandName = assertionName(check.kind);
        const execution = executeAlloyCommand(command, sourcePath, directory, commandName, `cell-${index}-${commandName}`);
        const actual = execution.counterexample ? "violated" : "holds";
        let status;
        if (!execution.executionPassed) status = "fail";
        else if (check.expectation === "holds") status = actual === "holds" ? "pass" : "fail";
        else status = actual === "violated" ? "counterexample" : "not-found";
        return {
          id: check.id,
          expectation: check.expectation,
          actual: execution.executionPassed ? actual : null,
          status,
          counterexample: renderAnalyzerCounterexample(execution.counterexample, compiled.model),
          error: execution.error,
        };
      });
      return { scopes: cell.scopes, steps: cell.steps, checks };
    });
    const summary = Object.fromEntries(model.checks.map((check) => {
      const results = cells.map((cell) => cell.checks.find((candidate) => candidate.id === check.id));
      const counterexamples = results.filter((result) => result.status === "counterexample" || result.status === "fail").length;
      const failed = check.expectation === "holds"
        ? results.some((result) => result.status === "fail")
        : results.some((result) => result.status === "fail") || counterexamples === 0;
      return [check.id, {
        expectation: check.expectation,
        counterexamples,
        status: failed ? "fail" : "pass",
      }];
    }));
    const failed = Object.entries(summary).filter(([, value]) => value.status === "fail").map(([id]) => `alloy scope matrix failed: ${id}`);
    return {
      status: failed.length === 0 ? "pass" : "fail",
      cells,
      summary,
      errors: failed,
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
