import { relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import {
  boundedReachabilityReport,
  evaluateLeanTemporalChecks,
  executeLeanTransitionSystem,
  initialLeanState,
  renderLeanTransitionSystem,
  validateLeanTemporalChecks,
  validateLeanTransitionSystem,
} from "./lean-semantic-core.mjs";

export const BEHAVIOR_MODEL_SCHEMA_VERSION = "1.0";

const MAX_GROUNDING_TRANSITIONS = 10_000;

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

function compileNat(expression) {
  if (!record(expression)) throw new Error("behavior natural-number expression is required");
  const children = list(expression.children).map(compileNat);
  switch (expression.kind) {
    case "current":
      return { kind: "state", field: expression.field ?? null, value: null, children };
    case "initial":
      return { kind: "initial", field: expression.field ?? null, value: null, children };
    case "input":
      return { kind: "input", field: expression.field ?? null, value: null, children };
    case "number":
      return { kind: "literal", field: null, value: expression.value ?? null, children };
    case "plus":
      return { kind: "add", field: null, value: null, children };
    case "minus":
      return { kind: "sub", field: null, value: null, children };
    default:
      throw new Error(`unknown behavior natural-number expression: ${expression.kind ?? "missing"}`);
  }
}

function compileConstraint(constraint) {
  if (!record(constraint)) throw new Error("behavior constraint is required");
  const terms = list(constraint.terms).map(compileNat);
  const children = list(constraint.children).map(compileConstraint);
  switch (constraint.kind) {
    case "atMost": return { kind: "le", terms, children };
    case "equals": return { kind: "eq", terms, children };
    case "allOf": return { kind: "and", terms, children };
    case "ifThen": return { kind: "implies", terms, children };
    default:
      throw new Error(`unknown behavior constraint: ${constraint.kind ?? "missing"}`);
  }
}

function compileTemporalFormula(formula) {
  if (!record(formula)) throw new Error("behavior temporal formula is required");
  const children = list(formula.children).map(compileTemporalFormula);
  const kind = {
    state: "state",
    not: "not",
    all: "and",
    any: "or",
    next: "next",
    always: "always",
    eventually: "eventually",
  }[formula.kind];
  if (!kind) throw new Error(`unknown behavior temporal formula: ${formula.kind ?? "missing"}`);
  return {
    kind,
    predicate: formula.constraint === null || formula.constraint === undefined
      ? null
      : compileConstraint(formula.constraint),
    children,
  };
}

/**
 * Lower the author-facing behavior vocabulary into the existing closed
 * transition-system representation. This is a deterministic compilation, not
 * a Lean parser and not an escape hatch for arbitrary Lean code.
 */
export function compileBehaviorModel(document) {
  const behavior = record(document?.behavior);
  if (!behavior) throw new Error("behavior specification is required");
  const transitionSystem = {
      id: behavior.id ?? null,
      stateFields: list(behavior.states).map((state) => ({ id: state?.id ?? null })),
      initialValues: list(behavior.states).map((state) => ({ field: state?.id ?? null, value: state?.initial ?? null })),
      actions: list(behavior.actions).map((action) => ({
        id: action?.id ?? null,
        parameters: list(action?.inputs).map((input) => ({
          id: input?.id ?? null,
          finiteValues: list(input?.samples),
        })),
        guard: compileConstraint(action?.requires),
        updates: list(action?.ensures).map((assignment) => ({
          field: assignment?.field ?? null,
          value: compileNat(assignment?.value),
        })),
      })),
      invariants: list(behavior.invariants).map((invariant) => ({
        id: invariant?.id ?? null,
        formula: compileConstraint(invariant?.constraint),
      })),
      boundedReachability: list(behavior.reachability).map((check) => ({
        id: check?.id ?? null,
        maxSteps: check?.maxSteps ?? null,
        expectation: check?.expectation ?? null,
        target: compileConstraint(check?.target),
      })),
    };
  return {
    transitionSystem,
    generatedLeanSource: renderLeanTransitionSystem(transitionSystem),
    temporalChecks: list(behavior.temporal).map((check) => ({
      id: check?.id ?? null,
      rule: check?.rule ?? null,
      scope: check?.scope ?? "path",
      maxSteps: check?.maxSteps ?? null,
      path: list(check?.path).map((step) => ({
        action: step?.action ?? null,
        input: Object.entries(record(step?.input) ?? {}).map(([field, value]) => ({ field, value })),
      })),
      formula: compileTemporalFormula(check?.formula),
      expectation: check?.expectation ?? null,
    })),
  };
}

function referencedRules(document, behavior, errors) {
  const rules = new Set(list(document?.model?.rules).map((rule) => rule?.id).filter(Boolean));
  const vocabulary = new Set(list(document?.model?.vocabulary).map((term) => term?.id).filter(Boolean));
  for (const term of list(behavior.terms)) {
    if (!vocabulary.has(term)) errors.push(`behavior references unknown domain term: ${term ?? "missing"}`);
  }
  for (const entry of [...list(behavior.invariants), ...list(behavior.reachability), ...list(behavior.temporal)]) {
    if (!rules.has(entry?.rule)) errors.push(`behavior references unknown domain rule: ${entry?.id ?? "missing"} -> ${entry?.rule ?? "missing"}`);
  }
}

function validateGrounding(behavior, errors) {
  const grounding = behavior?.grounding;
  if (grounding === null || grounding === undefined) return;
  if (!Number.isInteger(grounding.maxSteps) || grounding.maxSteps < 0) {
    errors.push("behavior grounding maxSteps must be a non-negative integer");
  }
  const actionIds = new Set(list(behavior.actions).map((action) => action?.id).filter(Boolean));
  const bindings = list(grounding.actions);
  const boundActions = new Set();
  for (const binding of bindings) {
    if (!actionIds.has(binding?.action)) {
      errors.push(`behavior grounding references unknown action: ${binding?.action ?? "missing"}`);
    }
    if (boundActions.has(binding?.action)) errors.push(`duplicate behavior grounding action: ${binding?.action}`);
    boundActions.add(binding?.action);
    const implementation = binding?.implementation;
    if (implementation?.kind !== "code" || typeof implementation.path !== "string" || !implementation.path || typeof implementation.symbol !== "string" || !implementation.symbol) {
      errors.push(`behavior grounding requires a code path and symbol: ${binding?.action ?? "missing"}`);
    }
  }
  for (const actionId of actionIds) {
    if (!boundActions.has(actionId)) errors.push(`behavior grounding is missing action: ${actionId}`);
  }
  for (const action of list(behavior.actions)) {
    for (const input of list(action?.inputs)) {
      if (list(input?.samples).length === 0) {
        errors.push(`behavior grounding requires input samples: ${action?.id ?? "missing"}.${input?.id ?? "missing"}`);
      }
    }
  }
}

/** Validate domain links, finite-model bounds, and adapter declarations. */
export function validateBehaviorModel(document) {
  const errors = [];
  const behavior = record(document?.behavior);
  if (!behavior) return ["behavior specification is required"];
  if (!behavior.id) errors.push("behavior id is required");
  duplicateIds(list(behavior.states), "behavior state", errors);
  duplicateIds(list(behavior.actions), "behavior action", errors);
  duplicateIds(list(behavior.invariants), "behavior invariant", errors);
  duplicateIds(list(behavior.reachability), "behavior reachability check", errors);
  duplicateIds(list(behavior.temporal), "behavior temporal check", errors);
  referencedRules(document, behavior, errors);
  validateGrounding(behavior, errors);

  try {
    const compiled = compileBehaviorModel(document);
    errors.push(...validateLeanTransitionSystem(compiled.transitionSystem));
    errors.push(...validateLeanTemporalChecks(compiled.temporalChecks, compiled.transitionSystem));
  } catch (error) {
    errors.push(`cannot compile behavior specification: ${error.message}`);
  }
  return errors;
}

function behaviorErrorReport(document, errors) {
  return {
    schemaVersion: BEHAVIOR_MODEL_SCHEMA_VERSION,
    model: { id: document?.model?.id ?? null, version: document?.model?.version ?? null },
    behavior: document?.behavior?.id ?? null,
    status: "fail",
    transitionSystem: null,
    generatedLeanSource: null,
    boundedReachability: null,
    temporal: null,
    errors,
  };
}

/**
 * Check the DSL's reference model. The generated Lean source is returned as a
 * reviewable backend artifact; its compilation is handled by the existing
 * Lean semantic-core pipeline when an authored proof is added.
 */
export function verifyBehaviorModel(document) {
  const errors = validateBehaviorModel(document);
  if (errors.length > 0) return behaviorErrorReport(document, errors);
  const compiled = compileBehaviorModel(document);
  const boundedReachability = boundedReachabilityReport(compiled.transitionSystem);
  const temporal = evaluateLeanTemporalChecks(compiled.transitionSystem, compiled.temporalChecks);
  const failures = [
    ...boundedReachability.checks.filter((check) => check.status === "fail").map((check) => `behavior reachability check failed: ${check.id}`),
    ...temporal.checks.filter((check) => check.status === "fail").map((check) => `behavior temporal check failed: ${check.id}`),
    ...boundedReachability.errors,
    ...temporal.errors,
  ];
  return {
    schemaVersion: BEHAVIOR_MODEL_SCHEMA_VERSION,
    model: { id: document?.model?.id ?? null, version: document?.model?.version ?? null },
    behavior: document.behavior.id,
    status: failures.length === 0 ? "pass" : "fail",
    transitionSystem: compiled.transitionSystem,
    generatedLeanSource: renderLeanTransitionSystem(compiled.transitionSystem),
    boundedReachability,
    temporal,
    errors: failures,
  };
}

function localPath(projectRoot, source) {
  const path = resolve(projectRoot, source ?? "");
  const fromRoot = relative(projectRoot, path);
  if (fromRoot === "" || (!fromRoot.startsWith(`..${sep}`) && fromRoot !== ".." && !fromRoot.startsWith(".."))) return path;
  return null;
}

function enumerateInputs(parameters, index = 0, input = {}) {
  if (index === parameters.length) return [input];
  const parameter = parameters[index];
  return list(parameter.finiteValues).flatMap((value) => enumerateInputs(
    parameters,
    index + 1,
    { ...input, [parameter.id]: value },
  ));
}

function actionInvocations(system) {
  return list(system.actions).flatMap((action) => enumerateInputs(list(action.parameters)).map((input) => ({ id: action.id, input })));
}

function naturalState(value, fields) {
  if (!record(value)) throw new Error("implementation adapter state must be an object");
  const state = {};
  for (const field of fields) {
    if (!Number.isInteger(value[field]) || value[field] < 0) {
      throw new Error(`implementation adapter state must contain non-negative integer: ${field}`);
    }
    state[field] = value[field];
  }
  for (const field of Object.keys(value)) {
    if (!fields.includes(field)) throw new Error(`implementation adapter state has unknown field: ${field}`);
  }
  return state;
}

function implementationTransition(value, fields) {
  if (!record(value) || (value.status !== "accepted" && value.status !== "rejected")) {
    throw new Error("implementation adapter must return accepted or rejected status");
  }
  return { status: value.status, state: naturalState(value.state, fields) };
}

function sameTransition(left, right, fields) {
  return left.status === right.status && fields.every((field) => left.state[field] === right.state[field]);
}

/**
 * Execute every declared finite action input at every path prefix and compare
 * the implementation adapter's observable transition to the DSL reference
 * semantics. This is executable conformance evidence, not a general proof of
 * the application implementation.
 */
export async function verifyBehaviorImplementation(document, { projectRoot = process.cwd() } = {}) {
  const errors = validateBehaviorModel(document);
  const behavior = record(document?.behavior);
  if (errors.length > 0 || !behavior?.grounding) {
    return {
      schemaVersion: BEHAVIOR_MODEL_SCHEMA_VERSION,
      behavior: behavior?.id ?? null,
      status: "fail",
      checkedTransitions: 0,
      counterexample: null,
      checks: [],
      errors: errors.length > 0 ? errors : ["behavior grounding is required"],
    };
  }

  const compiled = compileBehaviorModel(document);
  const system = compiled.transitionSystem;
  const fields = list(system.stateFields).map((field) => field.id);
  const bindings = new Map(list(behavior.grounding.actions).map((binding) => [binding.action, binding.implementation]));
  const adapters = new Map();
  try {
    for (const [action, implementation] of bindings) {
      const source = localPath(projectRoot, implementation.path);
      if (!source) throw new Error(`behavior grounding source escapes project root: ${implementation.path}`);
      const module = await import(pathToFileURL(source).href);
      const adapter = module[implementation.symbol];
      if (typeof adapter !== "function") throw new Error(`behavior grounding adapter is not a function: ${action} -> ${implementation.symbol}`);
      adapters.set(action, adapter);
    }
  } catch (error) {
    return {
      schemaVersion: BEHAVIOR_MODEL_SCHEMA_VERSION,
      behavior: behavior.id,
      status: "fail",
      checkedTransitions: 0,
      counterexample: null,
      checks: [],
      errors: [error.message],
    };
  }

  const invocations = actionInvocations(system);
  const checks = [];
  let frontier = [{ state: initialLeanState(system), path: [] }];
  for (let depth = 0; depth < behavior.grounding.maxSteps; depth += 1) {
    const next = [];
    for (const node of frontier) {
      for (const action of invocations) {
        if (checks.length >= MAX_GROUNDING_TRANSITIONS) {
          return {
            schemaVersion: BEHAVIOR_MODEL_SCHEMA_VERSION,
            behavior: behavior.id,
            status: "fail",
            checkedTransitions: checks.length,
            counterexample: null,
            checks,
            errors: [`behavior grounding exceeds ${MAX_GROUNDING_TRANSITIONS} transitions`],
          };
        }
        const expected = executeLeanTransitionSystem(system, node.state, action);
        let actual = null;
        let error = null;
        try {
          actual = implementationTransition(await adapters.get(action.id)({
            state: { ...node.state },
            input: { ...action.input },
          }), fields);
        } catch (cause) {
          error = cause instanceof Error ? cause.message : String(cause);
        }
        checks.push({
          depth,
          path: node.path,
          action,
          state: node.state,
          expected,
          actual,
          error,
          status: error === null && actual !== null && sameTransition(expected, actual, fields) ? "pass" : "fail",
        });
        next.push({ state: expected.state, path: [...node.path, action] });
      }
    }
    frontier = next;
  }

  const counterexample = checks.find((check) => check.status === "fail") ?? null;
  return {
    schemaVersion: BEHAVIOR_MODEL_SCHEMA_VERSION,
    behavior: behavior.id,
    status: counterexample === null ? "pass" : "fail",
    checkedTransitions: checks.length,
    counterexample: counterexample === null ? null : {
      depth: counterexample.depth,
      path: counterexample.path,
      action: counterexample.action,
      state: counterexample.state,
      expected: counterexample.expected,
      actual: counterexample.actual,
      error: counterexample.error,
    },
    checks,
    errors: counterexample === null ? [] : [
      counterexample.error ?? `behavior implementation mismatch: ${counterexample.action.id} at depth ${counterexample.depth}`,
    ],
  };
}
