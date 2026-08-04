import { existsSync, readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

export const LEAN_SEMANTIC_CORE_SCHEMA_VERSION = "1.0";

const ASSURANCE_KINDS = new Set(["bounded", "proved"]);
const REACHABILITY_EXPECTATIONS = new Set(["reachable", "unreachable"]);
const SAT_EXPECTATIONS = new Set(["sat", "unsat"]);
const TEMPORAL_EXPECTATIONS = new Set(["holds", "violated"]);
const TEMPORAL_SCOPES = new Set(["path", "allPaths"]);
const LEAN_DECLARATION_PATTERN = /^[A-Za-z_][A-Za-z0-9_'.]*$/;
const NAT_EXPR_KINDS = new Set(["state", "initial", "input", "literal", "add", "sub"]);
const FORMULA_KINDS = new Set(["le", "eq", "and", "implies"]);
const BOOLEAN_FORMULA_KINDS = new Set(["variable", "literal", "not", "and", "or"]);
const INT_EXPR_KINDS = new Set(["variable", "literal", "add", "sub", "scale"]);
const INT_FORMULA_KINDS = new Set(["le", "eq", "not", "and", "or"]);
const TEMPORAL_FORMULA_KINDS = new Set(["state", "not", "and", "or", "next", "always", "eventually", "until"]);
const MAX_BOUNDED_SMT_ASSIGNMENTS = 100_000;
const MAX_BOUNDED_TEMPORAL_PATHS = 10_000;

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

function sourcePath(projectRoot, source) {
  const path = resolve(projectRoot, source ?? "");
  const pathFromRoot = relative(projectRoot, path);
  if (pathFromRoot === "" || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== ".." && !pathFromRoot.startsWith(".."))) {
    return path;
  }
  return null;
}

function leanDeclarationKind(source, declaration) {
  const escaped = declaration.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^\\s*(theorem|def)\\s+${escaped}\\b`, "m").exec(source)?.[1] ?? null;
}

function emptyReport(document, status, errors) {
  return {
    schemaVersion: LEAN_SEMANTIC_CORE_SCHEMA_VERSION,
    model: { id: document?.model?.id ?? null, version: document?.model?.version ?? null },
    status,
    summary: { claims: 0, passed: 0, failed: 0 },
    bindings: [],
    boundedReachability: null,
    sat: null,
    dpll: null,
    tseitin: null,
    smt: null,
    z3: null,
    temporal: null,
    generatedTransition: null,
    errors,
    stdout: "",
    stderr: "",
  };
}

function validateNatExpression(expression, context, { stateFields, inputFields }, errors) {
  if (!record(expression)) {
    errors.push(`invalid natural-number expression: ${context}`);
    return;
  }
  if (!NAT_EXPR_KINDS.has(expression.kind)) {
    errors.push(`unknown natural-number expression kind: ${context} -> ${expression.kind ?? "missing"}`);
    return;
  }
  const children = list(expression.children);
  if (expression.kind === "state" || expression.kind === "initial") {
    if (!stateFields.has(expression.field)) errors.push(`unknown state field: ${context} -> ${expression.field ?? "missing"}`);
    if (children.length > 0) errors.push(`state expression cannot have children: ${context}`);
  } else if (expression.kind === "input") {
    if (!inputFields.has(expression.field)) errors.push(`unknown action input: ${context} -> ${expression.field ?? "missing"}`);
    if (children.length > 0) errors.push(`input expression cannot have children: ${context}`);
  } else if (expression.kind === "literal") {
    if (!Number.isInteger(expression.value) || expression.value < 0) {
      errors.push(`natural-number literal must be non-negative: ${context}`);
    }
    if (children.length > 0) errors.push(`literal expression cannot have children: ${context}`);
  } else {
    if (children.length !== 2) errors.push(`${expression.kind} expression requires exactly two children: ${context}`);
    children.forEach((child, index) => validateNatExpression(child, `${context}.${expression.kind}[${index}]`, { stateFields, inputFields }, errors));
  }
}

function validateFormula(formula, context, scope, errors) {
  if (!record(formula)) {
    errors.push(`invalid formula: ${context}`);
    return;
  }
  if (!FORMULA_KINDS.has(formula.kind)) {
    errors.push(`unknown formula kind: ${context} -> ${formula.kind ?? "missing"}`);
    return;
  }
  const terms = list(formula.terms);
  const children = list(formula.children);
  if (formula.kind === "le" || formula.kind === "eq") {
    if (terms.length !== 2) errors.push(`${formula.kind} formula requires exactly two terms: ${context}`);
    if (children.length > 0) errors.push(`${formula.kind} formula cannot have child formulas: ${context}`);
    terms.forEach((term, index) => validateNatExpression(term, `${context}.${formula.kind}[${index}]`, scope, errors));
    return;
  }
  if (formula.kind === "and" && children.length === 0) {
    errors.push(`and formula requires at least one child formula: ${context}`);
  }
  if (formula.kind === "implies" && children.length !== 2) {
    errors.push(`implies formula requires exactly 2 child formulas: ${context}`);
  }
  if (terms.length > 0) errors.push(`${formula.kind} formula cannot have natural-number terms: ${context}`);
  children.forEach((child, index) => validateFormula(child, `${context}.${formula.kind}[${index}]`, scope, errors));
}

function validateBooleanFormula(formula, context, variables, errors) {
  if (!record(formula)) {
    errors.push(`invalid Boolean formula: ${context}`);
    return;
  }
  if (!BOOLEAN_FORMULA_KINDS.has(formula.kind)) {
    errors.push(`unknown Boolean formula kind: ${context} -> ${formula.kind ?? "missing"}`);
    return;
  }
  const children = list(formula.children);
  if (formula.kind === "variable") {
    if (!variables.has(formula.name)) errors.push(`unknown Boolean variable: ${context} -> ${formula.name ?? "missing"}`);
    if (children.length > 0) errors.push(`Boolean variable cannot have children: ${context}`);
    return;
  }
  if (formula.kind === "literal") {
    if (typeof formula.value !== "boolean") errors.push(`Boolean literal must have a Boolean value: ${context}`);
    if (children.length > 0) errors.push(`Boolean literal cannot have children: ${context}`);
    return;
  }
  if (formula.kind === "not" && children.length !== 1) {
    errors.push(`not formula requires exactly one child formula: ${context}`);
  }
  if ((formula.kind === "and" || formula.kind === "or") && children.length === 0) {
    errors.push(`${formula.kind} formula requires at least one child formula: ${context}`);
  }
  children.forEach((child, index) => validateBooleanFormula(child, `${context}.${formula.kind}[${index}]`, variables, errors));
}

/** Validate the closed Boolean SAT fragment, independent of Lean bindings. */
export function validateLeanSatChecks(satChecks) {
  const errors = [];
  const checks = list(satChecks);
  duplicateIds(checks, "SAT check", errors);
  for (const check of checks) {
    if (!check?.id) continue;
    if (!SAT_EXPECTATIONS.has(check.expectation)) {
      errors.push(`unsupported SAT expectation: ${check.id} -> ${check.expectation ?? "missing"}`);
    }
    const variables = list(check.variables);
    const variableSet = new Set();
    for (const variable of variables) {
      if (typeof variable !== "string" || !LEAN_DECLARATION_PATTERN.test(variable)) {
        errors.push(`invalid Boolean variable: ${check.id} -> ${variable ?? "missing"}`);
        continue;
      }
      if (variableSet.has(variable)) errors.push(`duplicate Boolean variable: ${check.id} -> ${variable}`);
      variableSet.add(variable);
    }
    validateBooleanFormula(check.formula, `SAT check ${check.id}`, variableSet, errors);
  }
  return errors;
}

function validateIntExpression(expression, context, variables, errors) {
  if (!record(expression)) {
    errors.push(`invalid integer expression: ${context}`);
    return;
  }
  if (!INT_EXPR_KINDS.has(expression.kind)) {
    errors.push(`unknown integer expression kind: ${context} -> ${expression.kind ?? "missing"}`);
    return;
  }
  const children = list(expression.children);
  if (expression.kind === "variable") {
    if (!variables.has(expression.name)) errors.push(`unknown integer variable: ${context} -> ${expression.name ?? "missing"}`);
    if (children.length > 0) errors.push(`integer variable cannot have children: ${context}`);
    return;
  }
  if (expression.kind === "literal") {
    if (!Number.isSafeInteger(expression.value)) errors.push(`integer literal must be a safe integer: ${context}`);
    if (children.length > 0) errors.push(`integer literal cannot have children: ${context}`);
    return;
  }
  if (expression.kind === "scale") {
    if (!Number.isSafeInteger(expression.coefficient)) errors.push(`integer scale coefficient must be a safe integer: ${context}`);
    if (children.length !== 1) errors.push(`scale expression requires exactly one child: ${context}`);
  } else if (children.length !== 2) {
    errors.push(`${expression.kind} expression requires exactly two children: ${context}`);
  }
  children.forEach((child, index) => validateIntExpression(child, `${context}.${expression.kind}[${index}]`, variables, errors));
}

function validateIntFormula(formula, context, variables, errors) {
  if (!record(formula)) {
    errors.push(`invalid integer formula: ${context}`);
    return;
  }
  if (!INT_FORMULA_KINDS.has(formula.kind)) {
    errors.push(`unknown integer formula kind: ${context} -> ${formula.kind ?? "missing"}`);
    return;
  }
  const terms = list(formula.terms);
  const children = list(formula.children);
  if (formula.kind === "le" || formula.kind === "eq") {
    if (terms.length !== 2) errors.push(`${formula.kind} integer formula requires exactly two terms: ${context}`);
    if (children.length > 0) errors.push(`${formula.kind} integer formula cannot have child formulas: ${context}`);
    terms.forEach((term, index) => validateIntExpression(term, `${context}.${formula.kind}[${index}]`, variables, errors));
    return;
  }
  if (formula.kind === "not" && children.length !== 1) {
    errors.push(`not integer formula requires exactly one child formula: ${context}`);
  }
  if ((formula.kind === "and" || formula.kind === "or") && children.length === 0) {
    errors.push(`${formula.kind} integer formula requires at least one child formula: ${context}`);
  }
  if (terms.length > 0) errors.push(`${formula.kind} integer formula cannot have integer terms: ${context}`);
  children.forEach((child, index) => validateIntFormula(child, `${context}.${formula.kind}[${index}]`, variables, errors));
}

/** Validate the bounded linear-integer fragment before enumeration or SMT export. */
export function validateLeanSmtChecks(smtChecks) {
  const errors = [];
  const checks = list(smtChecks);
  duplicateIds(checks, "SMT check", errors);
  for (const check of checks) {
    if (!check?.id) continue;
    if (!SAT_EXPECTATIONS.has(check.expectation)) {
      errors.push(`unsupported SMT expectation: ${check.id} -> ${check.expectation ?? "missing"}`);
    }
    const variables = list(check.variables);
    const variableSet = duplicateIds(variables, `bounded integer variable for ${check.id}`, errors);
    let assignments = 1;
    for (const variable of variables) {
      if (!variable?.id) continue;
      if (!Number.isSafeInteger(variable.lower) || !Number.isSafeInteger(variable.upper)) {
        errors.push(`bounded integer range must use safe integers: ${check.id}.${variable.id}`);
        continue;
      }
      if (variable.lower > variable.upper) {
        errors.push(`bounded integer lower bound exceeds upper bound: ${check.id}.${variable.id}`);
        continue;
      }
      assignments *= variable.upper - variable.lower + 1;
    }
    if (assignments > MAX_BOUNDED_SMT_ASSIGNMENTS) {
      errors.push(`bounded SMT enumeration exceeds ${MAX_BOUNDED_SMT_ASSIGNMENTS} assignments: ${check.id}`);
    }
    validateIntFormula(check.formula, `SMT check ${check.id}`, variableSet, errors);
  }
  return errors;
}

/** Validate the closed Pkl transition-system fragment that Lean interprets. */
export function validateLeanTransitionSystem(system) {
  const errors = [];
  if (!record(system)) return ["leanCore transitionSystem is required"];
  if (!system.id) errors.push("leanCore transitionSystem id is required");

  const stateEntries = list(system.stateFields);
  const stateFields = duplicateIds(stateEntries, "transition-system state field", errors);
  if (stateEntries.length === 0) errors.push("transitionSystem requires at least one state field");

  const initialFields = new Set();
  for (const initial of list(system.initialValues)) {
    if (!stateFields.has(initial?.field)) errors.push(`unknown initial state field: ${initial?.field ?? "missing"}`);
    if (initialFields.has(initial?.field)) errors.push(`duplicate initial state field: ${initial.field}`);
    initialFields.add(initial?.field);
    if (!Number.isInteger(initial?.value) || initial.value < 0) {
      errors.push(`initial state value must be a non-negative integer: ${initial?.field ?? "missing"}`);
    }
  }
  for (const field of stateFields) {
    if (!initialFields.has(field)) errors.push(`missing initial state value: ${field}`);
  }

  const actionEntries = list(system.actions);
  const boundedReachability = list(system.boundedReachability);
  duplicateIds(actionEntries, "transition-system action", errors);
  if (actionEntries.length === 0) errors.push("transitionSystem requires at least one action");
  for (const action of actionEntries) {
    if (!action?.id) continue;
    const parameters = list(action.parameters);
    const inputFields = duplicateIds(parameters, `action parameter for ${action.id}`, errors);
    for (const parameter of parameters) {
      if (!parameter?.id) continue;
      const finiteValues = list(parameter.finiteValues);
      const seenFiniteValues = new Set();
      for (const value of finiteValues) {
        if (!Number.isInteger(value) || value < 0) {
          errors.push(`bounded action value must be a non-negative integer: ${action.id}.${parameter.id}`);
          continue;
        }
        if (seenFiniteValues.has(value)) {
          errors.push(`duplicate bounded action value: ${action.id}.${parameter.id} -> ${value}`);
        }
        seenFiniteValues.add(value);
      }
      if (boundedReachability.length > 0 && finiteValues.length === 0) {
        errors.push(`bounded reachability requires finite action values: ${action.id}.${parameter.id}`);
      }
    }
    const scope = { stateFields, inputFields };
    validateFormula(action.guard, `action ${action.id} guard`, scope, errors);
    const updatedFields = new Set();
    for (const update of list(action.updates)) {
      if (!stateFields.has(update?.field)) errors.push(`unknown updated state field: action ${action.id} -> ${update?.field ?? "missing"}`);
      if (updatedFields.has(update?.field)) errors.push(`duplicate updated state field: action ${action.id} -> ${update.field}`);
      updatedFields.add(update?.field);
      validateNatExpression(update?.value, `action ${action.id} update ${update?.field ?? "missing"}`, scope, errors);
    }
  }

  const invariantEntries = list(system.invariants);
  duplicateIds(invariantEntries, "transition-system invariant", errors);
  for (const invariant of invariantEntries) {
    if (!invariant?.id) continue;
    validateFormula(invariant.formula, `invariant ${invariant.id}`, { stateFields, inputFields: new Set() }, errors);
  }

  duplicateIds(boundedReachability, "bounded reachability check", errors);
  for (const check of boundedReachability) {
    if (!check?.id) continue;
    if (!Number.isInteger(check.maxSteps) || check.maxSteps < 0) {
      errors.push(`bounded reachability maxSteps must be a non-negative integer: ${check.id}`);
    }
    if (!REACHABILITY_EXPECTATIONS.has(check.expectation)) {
      errors.push(`unsupported bounded reachability expectation: ${check.id} -> ${check.expectation ?? "missing"}`);
    }
    validateFormula(check.target, `bounded reachability target ${check.id}`, { stateFields, inputFields: new Set() }, errors);
  }
  return errors;
}

function validateTemporalFormula(formula, context, stateFields, errors) {
  if (!record(formula)) {
    errors.push(`invalid temporal formula: ${context}`);
    return;
  }
  if (!TEMPORAL_FORMULA_KINDS.has(formula.kind)) {
    errors.push(`unknown temporal formula kind: ${context} -> ${formula.kind ?? "missing"}`);
    return;
  }
  const children = list(formula.children);
  if (formula.kind === "state") {
    if (!record(formula.predicate)) errors.push(`state temporal formula requires a predicate: ${context}`);
    else validateFormula(formula.predicate, `${context}.state`, { stateFields, inputFields: new Set() }, errors);
    if (children.length > 0) errors.push(`state temporal formula cannot have child formulas: ${context}`);
    return;
  }
  if (formula.predicate !== null && formula.predicate !== undefined) {
    errors.push(`${formula.kind} temporal formula cannot have a state predicate: ${context}`);
  }
  if ((formula.kind === "not" || formula.kind === "next" || formula.kind === "always" || formula.kind === "eventually") && children.length !== 1) {
    errors.push(`${formula.kind} temporal formula requires exactly one child formula: ${context}`);
  }
  if (formula.kind === "until" && children.length !== 2) {
    errors.push(`until temporal formula requires exactly two child formulas: ${context}`);
  }
  if ((formula.kind === "and" || formula.kind === "or") && children.length === 0) {
    errors.push(`${formula.kind} temporal formula requires at least one child formula: ${context}`);
  }
  children.forEach((child, index) => validateTemporalFormula(child, `${context}.${formula.kind}[${index}]`, stateFields, errors));
}

function temporalScope(check) {
  return check?.scope ?? "path";
}

function temporalHasSchedulingAssumptions(check) {
  return list(check?.fairness).length > 0;
}

function temporalAssurance(check) {
  if (temporalScope(check) === "allPaths") return "bounded-all-paths";
  return temporalHasSchedulingAssumptions(check) ? "finite-scheduled-trace" : "finite-trace";
}

/** Validate finite temporal checks against the closed transition-system AST. */
export function validateLeanTemporalChecks(temporalChecks, system) {
  const errors = [];
  if (!record(system)) return ["leanCore transitionSystem is required for temporal checks"];
  const checks = list(temporalChecks);
  const stateFields = new Set(list(system.stateFields).map((field) => field?.id).filter(Boolean));
  const actions = new Map(list(system.actions).map((action) => [action?.id, action]));
  duplicateIds(checks, "temporal check", errors);
  for (const check of checks) {
    if (!check?.id) continue;
    if (!TEMPORAL_EXPECTATIONS.has(check.expectation)) {
      errors.push(`unsupported temporal expectation: ${check.id} -> ${check.expectation ?? "missing"}`);
    }
    const scope = temporalScope(check);
    const fairness = list(check.fairness);
    duplicateIds(fairness.map((assumption) => ({ id: assumption?.action })), `scheduling assumption for ${check.id}`, errors);
    if (!TEMPORAL_SCOPES.has(scope)) {
      errors.push(`unsupported temporal scope: ${check.id} -> ${scope}`);
    } else if (scope === "allPaths") {
      if (!Number.isInteger(check.maxSteps) || check.maxSteps < 0) {
        errors.push(`all-path temporal check maxSteps must be a non-negative integer: ${check.id}`);
      }
      if (list(check.path).length > 0) {
        errors.push(`all-path temporal check cannot declare an explicit path: ${check.id}`);
      }
      if (fairness.length > 0) {
        errors.push(`all-path temporal check cannot declare scheduling assumptions: ${check.id}`);
      }
      for (const action of actions.values()) {
        for (const parameter of list(action.parameters)) {
          if (list(parameter.finiteValues).length === 0) {
            errors.push(`all-path temporal check requires finite action values: ${check.id} -> ${action.id}.${parameter.id}`);
          }
        }
      }
    } else {
      if (check.maxSteps !== null && check.maxSteps !== undefined) {
        errors.push(`explicit-path temporal check cannot set maxSteps: ${check.id}`);
      }
      for (const [index, step] of list(check.path).entries()) {
        const action = actions.get(step?.action);
        if (!action) {
          errors.push(`unknown temporal path action: ${check.id}[${index}] -> ${step?.action ?? "missing"}`);
          continue;
        }
        const inputs = list(step.input);
        const inputFields = duplicateIds(inputs.map((input) => ({ id: input?.field })), `temporal path input for ${check.id}[${index}]`, errors);
        const parameterFields = new Set(list(action.parameters).map((parameter) => parameter?.id).filter(Boolean));
        for (const input of inputs) {
          if (!parameterFields.has(input?.field)) errors.push(`unknown temporal path input: ${check.id}[${index}] -> ${input?.field ?? "missing"}`);
          if (!Number.isInteger(input?.value) || input.value < 0) {
            errors.push(`temporal path input must be a non-negative integer: ${check.id}[${index}] -> ${input?.field ?? "missing"}`);
          }
        }
        for (const parameter of parameterFields) {
          if (!inputFields.has(parameter)) errors.push(`missing temporal path input: ${check.id}[${index}] -> ${parameter}`);
        }
      }
      const pathActions = new Set(list(check.path).map((step) => step?.action).filter(Boolean));
      for (const assumption of fairness) {
        if (!actions.has(assumption?.action)) {
          errors.push(`unknown scheduling assumption action: ${check.id} -> ${assumption?.action ?? "missing"}`);
        } else if (!pathActions.has(assumption.action)) {
          errors.push(`scheduling assumption action is absent from explicit path: ${check.id} -> ${assumption.action}`);
        }
        if (typeof assumption?.reason !== "string" || assumption.reason.length === 0) {
          errors.push(`scheduling assumption requires a reason: ${check.id} -> ${assumption?.action ?? "missing"}`);
        }
      }
    }
    validateTemporalFormula(check.formula, `temporal check ${check.id}`, stateFields, errors);
  }
  return errors;
}

function evaluateNatExpression(expression, { state, initial, input }) {
  switch (expression.kind) {
    case "state": return state[expression.field];
    case "initial": return initial[expression.field];
    case "input": return input[expression.field];
    case "literal": return expression.value;
    case "add": return evaluateNatExpression(expression.children[0], { state, initial, input }) + evaluateNatExpression(expression.children[1], { state, initial, input });
    case "sub": return Math.max(0, evaluateNatExpression(expression.children[0], { state, initial, input }) - evaluateNatExpression(expression.children[1], { state, initial, input }));
    default: throw new Error(`cannot evaluate unknown natural-number expression kind: ${expression.kind}`);
  }
}

function evaluateFormula(formula, context) {
  switch (formula.kind) {
    case "le": return evaluateNatExpression(formula.terms[0], context) <= evaluateNatExpression(formula.terms[1], context);
    case "eq": return evaluateNatExpression(formula.terms[0], context) === evaluateNatExpression(formula.terms[1], context);
    case "and": return formula.children.every((child) => evaluateFormula(child, context));
    case "implies": return !evaluateFormula(formula.children[0], context) || evaluateFormula(formula.children[1], context);
    default: throw new Error(`cannot evaluate unknown formula kind: ${formula.kind}`);
  }
}

/** Evaluate a closed Boolean SAT formula under one total assignment. */
export function evaluateLeanBooleanFormula(formula, assignment) {
  switch (formula.kind) {
    case "variable": return assignment[formula.name];
    case "literal": return formula.value;
    case "not": return !evaluateLeanBooleanFormula(formula.children[0], assignment);
    case "and": return formula.children.every((child) => evaluateLeanBooleanFormula(child, assignment));
    case "or": return formula.children.some((child) => evaluateLeanBooleanFormula(child, assignment));
    default: throw new Error(`cannot evaluate unknown Boolean formula kind: ${formula.kind}`);
  }
}

function enumerateBooleanAssignments(variables, index = 0, assignment = {}) {
  if (index === variables.length) return [assignment];
  const variable = variables[index];
  return [false, true].flatMap((value) => enumerateBooleanAssignments(
    variables,
    index + 1,
    { ...assignment, [variable]: value },
  ));
}

/**
 * Decide each declared SAT or UNSAT expectation by enumerating every Boolean
 * assignment. The result is exhaustive for the listed variables, but does not
 * establish that the hand-authored Lean formula has the same denotation.
 */
export function solveLeanSatChecks(satChecks) {
  const errors = validateLeanSatChecks(satChecks);
  if (errors.length > 0) {
    return { status: "fail", checkedAssignments: 0, checks: [], errors };
  }

  const checks = list(satChecks);
  const results = checks.map((check) => {
    const assignments = enumerateBooleanAssignments(list(check.variables));
    const witness = assignments.find((assignment) => evaluateLeanBooleanFormula(check.formula, assignment));
    const satisfiable = witness !== undefined;
    const status = check.expectation === "sat"
      ? (satisfiable ? "pass" : "fail")
      : (satisfiable ? "fail" : "pass");
    return {
      id: check.id,
      assurance: "exhaustive",
      expectation: check.expectation,
      status,
      checkedAssignments: assignments.length,
      witness: witness ?? null,
    };
  });
  return {
    status: results.every((result) => result.status === "pass") ? "pass" : "fail",
    checkedAssignments: results.reduce((total, result) => total + result.checkedAssignments, 0),
    checks: results,
    errors: [],
  };
}

function checkedIntegerArithmetic(value, context) {
  if (!Number.isSafeInteger(value)) throw new Error(`integer arithmetic escaped safe range: ${context}`);
  return value;
}

/** Evaluate one bounded-linear-integer expression under a total assignment. */
export function evaluateLeanIntExpression(expression, assignment) {
  switch (expression.kind) {
    case "variable": return assignment[expression.name];
    case "literal": return expression.value;
    case "add": return checkedIntegerArithmetic(
      evaluateLeanIntExpression(expression.children[0], assignment) + evaluateLeanIntExpression(expression.children[1], assignment),
      "add",
    );
    case "sub": return checkedIntegerArithmetic(
      evaluateLeanIntExpression(expression.children[0], assignment) - evaluateLeanIntExpression(expression.children[1], assignment),
      "sub",
    );
    case "scale": return checkedIntegerArithmetic(
      expression.coefficient * evaluateLeanIntExpression(expression.children[0], assignment),
      "scale",
    );
    default: throw new Error(`cannot evaluate unknown integer expression kind: ${expression.kind}`);
  }
}

/** Evaluate a bounded-linear-integer formula under a total assignment. */
export function evaluateLeanIntFormula(formula, assignment) {
  switch (formula.kind) {
    case "le": return evaluateLeanIntExpression(formula.terms[0], assignment) <= evaluateLeanIntExpression(formula.terms[1], assignment);
    case "eq": return evaluateLeanIntExpression(formula.terms[0], assignment) === evaluateLeanIntExpression(formula.terms[1], assignment);
    case "not": return !evaluateLeanIntFormula(formula.children[0], assignment);
    case "and": return formula.children.every((child) => evaluateLeanIntFormula(child, assignment));
    case "or": return formula.children.some((child) => evaluateLeanIntFormula(child, assignment));
    default: throw new Error(`cannot evaluate unknown integer formula kind: ${formula.kind}`);
  }
}

function enumerateBoundedIntegerAssignments(variables, index = 0, assignment = {}) {
  if (index === variables.length) return [assignment];
  const variable = variables[index];
  const assignments = [];
  for (let value = variable.lower; value <= variable.upper; value += 1) {
    assignments.push(...enumerateBoundedIntegerAssignments(
      variables,
      index + 1,
      { ...assignment, [variable.id]: value },
    ));
  }
  return assignments;
}

/**
 * Decide the bounded integer fragment by evaluating every declared assignment.
 * This is exact only for the explicit finite ranges, not for all mathematical
 * integers.
 */
export function solveLeanSmtChecks(smtChecks) {
  const errors = validateLeanSmtChecks(smtChecks);
  if (errors.length > 0) {
    return { status: "fail", checkedAssignments: 0, checks: [], errors };
  }

  const checks = list(smtChecks);
  const results = checks.map((check) => {
    const assignments = enumerateBoundedIntegerAssignments(list(check.variables));
    const witness = assignments.find((assignment) => evaluateLeanIntFormula(check.formula, assignment));
    const satisfiable = witness !== undefined;
    const status = check.expectation === "sat"
      ? (satisfiable ? "pass" : "fail")
      : (satisfiable ? "fail" : "pass");
    return {
      id: check.id,
      assurance: "bounded-exhaustive",
      expectation: check.expectation,
      status,
      checkedAssignments: assignments.length,
      witness: witness ?? null,
    };
  });
  return {
    status: results.every((result) => result.status === "pass") ? "pass" : "fail",
    checkedAssignments: results.reduce((total, result) => total + result.checkedAssignments, 0),
    checks: results,
    errors: [],
  };
}

function smtSymbol(identifier) {
  return `|${identifier}|`;
}

function smtInteger(value) {
  return value < 0 ? `(- ${Math.abs(value)})` : String(value);
}

function renderSmtIntExpression(expression) {
  switch (expression.kind) {
    case "variable": return smtSymbol(expression.name);
    case "literal": return smtInteger(expression.value);
    case "add": return `(+ ${renderSmtIntExpression(expression.children[0])} ${renderSmtIntExpression(expression.children[1])})`;
    case "sub": return `(- ${renderSmtIntExpression(expression.children[0])} ${renderSmtIntExpression(expression.children[1])})`;
    case "scale": return `(* ${smtInteger(expression.coefficient)} ${renderSmtIntExpression(expression.children[0])})`;
    default: throw new Error(`cannot render unknown integer expression kind: ${expression.kind}`);
  }
}

function renderSmtIntFormula(formula) {
  switch (formula.kind) {
    case "le": return `(<= ${renderSmtIntExpression(formula.terms[0])} ${renderSmtIntExpression(formula.terms[1])})`;
    case "eq": return `(= ${renderSmtIntExpression(formula.terms[0])} ${renderSmtIntExpression(formula.terms[1])})`;
    case "not": return `(not ${renderSmtIntFormula(formula.children[0])})`;
    case "and": return `(and ${formula.children.map(renderSmtIntFormula).join(" ")})`;
    case "or": return `(or ${formula.children.map(renderSmtIntFormula).join(" ")})`;
    default: throw new Error(`cannot render unknown integer formula kind: ${formula.kind}`);
  }
}

/** Render one closed bounded integer check as a QF_LIA SMT-LIB program. */
export function renderLeanSmtLibCheck(check) {
  const errors = validateLeanSmtChecks([check]);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  const declarations = list(check.variables).flatMap((variable) => [
    `(declare-const ${smtSymbol(variable.id)} Int)`,
    `(assert (and (<= ${smtInteger(variable.lower)} ${smtSymbol(variable.id)}) (<= ${smtSymbol(variable.id)} ${smtInteger(variable.upper)})))`,
  ]);
  return [
    "(set-logic QF_LIA)",
    ...declarations,
    `(assert ${renderSmtIntFormula(check.formula)})`,
    "(check-sat)",
    "",
  ].join("\n");
}

function smtResult(stdout) {
  return stdout.split(/\r?\n/).map((line) => line.trim()).find((line) => ["sat", "unsat", "unknown"].includes(line)) ?? null;
}

/**
 * Ask Z3 to decide each emitted QF_LIA program. Missing Z3 is reported as a
 * skip so callers can retain the bounded reference result without pretending
 * that an external SMT backend ran.
 */
export function verifyLeanSmtChecksZ3(smtChecks, { z3Command = "z3" } = {}) {
  const errors = validateLeanSmtChecks(smtChecks);
  if (errors.length > 0) {
    return { status: "fail", checks: [], errors };
  }

  const checks = [];
  for (const check of list(smtChecks)) {
    const smtLib = renderLeanSmtLibCheck(check);
    const run = spawnSync(z3Command, ["-in", "-smt2"], { input: smtLib, encoding: "utf8" });
    if (run.error?.code === "ENOENT") {
      return { status: "skip", checks: [], errors: [`Z3 executable not found: ${z3Command}`] };
    }
    if (run.error) {
      return { status: "fail", checks, errors: [`Z3 invocation failed: ${run.error.message}`] };
    }
    const result = smtResult(run.stdout ?? "");
    if (run.status !== 0 || result === null) {
      return {
        status: "fail",
        checks,
        errors: [`Z3 returned no satisfiability result for ${check.id}`],
        stdout: run.stdout ?? "",
        stderr: run.stderr ?? "",
      };
    }
    const status = result === check.expectation ? "pass" : "fail";
    checks.push({
      id: check.id,
      solver: "z3-qf-lia",
      expectation: check.expectation,
      result,
      status,
      smtLib,
      stdout: run.stdout ?? "",
      stderr: run.stderr ?? "",
    });
  }
  return {
    status: checks.every((check) => check.status === "pass") ? "pass" : "fail",
    checks,
    errors: [],
  };
}

function normalizeClause(literals) {
  const byVariable = new Map();
  for (const literal of literals) {
    const existing = byVariable.get(literal.variable);
    if (existing !== undefined && existing.negated !== literal.negated) return null;
    if (existing === undefined) byVariable.set(literal.variable, literal);
  }
  return [...byVariable.values()];
}

function clauseKey(clause) {
  return clause
    .map((literal) => `${literal.negated ? "!" : ""}${literal.variable}`)
    .sort()
    .join("|");
}

/** Keep CNF deterministic while removing duplicate and tautological clauses. */
function normalizeCnf(cnf) {
  const clauses = [];
  const seen = new Set();
  for (const clause of cnf) {
    const normalized = normalizeClause(clause);
    if (normalized === null) continue;
    if (normalized.length === 0) return [[]];
    const key = clauseKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    clauses.push(normalized);
  }
  return clauses;
}

function toNegationNormalForm(formula, negated = false) {
  switch (formula.kind) {
    case "variable":
      return { kind: "literal", variable: formula.name, negated };
    case "literal":
      return { kind: "constant", value: negated ? !formula.value : formula.value };
    case "not":
      return toNegationNormalForm(formula.children[0], !negated);
    case "and":
      return {
        kind: negated ? "or" : "and",
        children: formula.children.map((child) => toNegationNormalForm(child, negated)),
      };
    case "or":
      return {
        kind: negated ? "and" : "or",
        children: formula.children.map((child) => toNegationNormalForm(child, negated)),
      };
    default:
      throw new Error(`cannot normalize unknown Boolean formula kind: ${formula.kind}`);
  }
}

function distributeCnf(left, right) {
  if (left.length === 0 || right.length === 0) return [];
  return normalizeCnf(left.flatMap((leftClause) => right.map((rightClause) => [
    ...leftClause,
    ...rightClause,
  ])));
}

function cnfFromNegationNormalForm(formula) {
  if (formula.kind === "constant") return formula.value ? [] : [[]];
  if (formula.kind === "literal") return [[{ variable: formula.variable, negated: formula.negated }]];
  const childCnfs = formula.children.map(cnfFromNegationNormalForm);
  if (formula.kind === "and") return normalizeCnf(childCnfs.flat());
  if (formula.kind === "or") return childCnfs.reduce(distributeCnf);
  throw new Error(`cannot lower NNF formula kind to CNF: ${formula.kind}`);
}

/**
 * Convert the closed Boolean AST into an equivalent, deterministic CNF.
 * Distribution can grow exponentially, so this is a teaching/reference path,
 * not yet a Tseitin encoding for large formulas.
 */
export function normalizeLeanBooleanFormulaToCnf(formula) {
  return cnfFromNegationNormalForm(toNegationNormalForm(formula));
}

function literalValue(literal, assignment) {
  if (!(literal.variable in assignment)) return undefined;
  return literal.negated ? !assignment[literal.variable] : assignment[literal.variable];
}

function simplifyCnf(cnf, assignment) {
  const remaining = [];
  for (const clause of cnf) {
    if (clause.some((literal) => literalValue(literal, assignment) === true)) continue;
    remaining.push(clause.filter((literal) => literalValue(literal, assignment) !== false));
  }
  return normalizeCnf(remaining);
}

function assignLiteral(assignment, literal) {
  const value = !literal.negated;
  if (literal.variable in assignment && assignment[literal.variable] !== value) return null;
  return { ...assignment, [literal.variable]: value };
}

function pureLiteral(cnf, assignment) {
  const signs = new Map();
  for (const clause of cnf) {
    for (const literal of clause) {
      if (literal.variable in assignment) continue;
      const sign = signs.get(literal.variable);
      if (sign === undefined) signs.set(literal.variable, literal.negated);
      else if (sign !== literal.negated) signs.set(literal.variable, null);
    }
  }
  for (const [variable, negated] of signs) {
    if (negated !== null) return { variable, negated };
  }
  return null;
}

function dpll(cnf, assignment, statistics) {
  const simplified = simplifyCnf(cnf, assignment);
  if (simplified.some((clause) => clause.length === 0)) return null;
  if (simplified.length === 0) return assignment;

  const unit = simplified.find((clause) => clause.length === 1)?.[0];
  if (unit) {
    const next = assignLiteral(assignment, unit);
    if (next === null) return null;
    statistics.propagations += 1;
    return dpll(simplified, next, statistics);
  }

  const pure = pureLiteral(simplified, assignment);
  if (pure) {
    const next = assignLiteral(assignment, pure);
    if (next === null) return null;
    statistics.pureAssignments += 1;
    return dpll(simplified, next, statistics);
  }

  const variable = simplified[0][0].variable;
  statistics.decisions += 1;
  const whenTrue = dpll(simplified, { ...assignment, [variable]: true }, statistics);
  return whenTrue ?? dpll(simplified, { ...assignment, [variable]: false }, statistics);
}

function totalBooleanAssignment(partialAssignment, variables) {
  return Object.fromEntries(variables.map((variable) => [variable, partialAssignment[variable] ?? false]));
}

/**
 * Solve the closed Boolean SAT fragment with CNF + DPLL. The exhaustive solver
 * remains the reference oracle; callers should compare the two for finite
 * models while this implementation evolves.
 */
export function solveLeanSatChecksDpll(satChecks) {
  const errors = validateLeanSatChecks(satChecks);
  if (errors.length > 0) {
    return { status: "fail", decisions: 0, propagations: 0, checks: [], errors };
  }

  const checks = list(satChecks);
  const results = checks.map((check) => {
    const cnf = normalizeLeanBooleanFormulaToCnf(check.formula);
    const statistics = { decisions: 0, propagations: 0, pureAssignments: 0 };
    const partialAssignment = dpll(cnf, {}, statistics);
    const witness = partialAssignment === null
      ? null
      : totalBooleanAssignment(partialAssignment, list(check.variables));
    if (witness !== null && !evaluateLeanBooleanFormula(check.formula, witness)) {
      throw new Error(`DPLL produced a non-satisfying assignment: ${check.id}`);
    }
    const satisfiable = witness !== null;
    const status = check.expectation === "sat"
      ? (satisfiable ? "pass" : "fail")
      : (satisfiable ? "fail" : "pass");
    return {
      id: check.id,
      solver: "dpll",
      expectation: check.expectation,
      status,
      cnf,
      decisions: statistics.decisions,
      propagations: statistics.propagations,
      pureAssignments: statistics.pureAssignments,
      witness,
    };
  });
  return {
    status: results.every((result) => result.status === "pass") ? "pass" : "fail",
    decisions: results.reduce((total, result) => total + result.decisions, 0),
    propagations: results.reduce((total, result) => total + result.propagations, 0),
    checks: results,
    errors: [],
  };
}

function negateLiteral(literal) {
  return { variable: literal.variable, negated: !literal.negated };
}

function createTseitinAllocator(variables) {
  const used = new Set(variables);
  const auxiliaryVariables = [];
  let index = 0;
  return {
    allocate() {
      let variable = `__tseitin_${index}`;
      while (used.has(variable)) {
        index += 1;
        variable = `__tseitin_${index}`;
      }
      used.add(variable);
      auxiliaryVariables.push(variable);
      index += 1;
      return { variable, negated: false };
    },
    auxiliaryVariables,
  };
}

/**
 * Encode the formula into equisatisfiable CNF with fresh auxiliary variables.
 * The final unit clause asserts that the root formula is true. Unlike direct
 * distribution, each composite subformula contributes only a linear number
 * of clauses.
 */
export function encodeLeanBooleanFormulaTseitin(formula, variables) {
  const allocator = createTseitinAllocator(variables);
  const clauses = [];

  function encode(node) {
    if (node.kind === "variable") return { variable: node.name, negated: false };
    if (node.kind === "literal") {
      const literal = allocator.allocate();
      clauses.push([{ variable: literal.variable, negated: !node.value }]);
      return literal;
    }
    if (node.kind === "not") return negateLiteral(encode(node.children[0]));

    const children = node.children.map(encode);
    const result = allocator.allocate();
    if (node.kind === "and") {
      for (const child of children) clauses.push([negateLiteral(result), child]);
      clauses.push([result, ...children.map(negateLiteral)]);
      return result;
    }
    if (node.kind === "or") {
      clauses.push([negateLiteral(result), ...children]);
      for (const child of children) clauses.push([result, negateLiteral(child)]);
      return result;
    }
    throw new Error(`cannot Tseitin-encode Boolean formula kind: ${node.kind}`);
  }

  const root = encode(formula);
  clauses.push([root]);
  return {
    cnf: normalizeCnf(clauses),
    root,
    auxiliaryVariables: allocator.auxiliaryVariables,
  };
}

/**
 * Solve with DPLL after a Tseitin encoding. The returned witness deliberately
 * projects away generated variables, so callers see only domain variables.
 */
export function solveLeanSatChecksTseitin(satChecks) {
  const errors = validateLeanSatChecks(satChecks);
  if (errors.length > 0) {
    return { status: "fail", decisions: 0, propagations: 0, checks: [], errors };
  }

  const checks = list(satChecks);
  const results = checks.map((check) => {
    const originalVariables = list(check.variables);
    const encoding = encodeLeanBooleanFormulaTseitin(check.formula, originalVariables);
    const statistics = { decisions: 0, propagations: 0, pureAssignments: 0 };
    const partialAssignment = dpll(encoding.cnf, {}, statistics);
    const witness = partialAssignment === null
      ? null
      : totalBooleanAssignment(partialAssignment, originalVariables);
    if (witness !== null && !evaluateLeanBooleanFormula(check.formula, witness)) {
      throw new Error(`Tseitin DPLL produced a non-satisfying assignment: ${check.id}`);
    }
    const satisfiable = witness !== null;
    const status = check.expectation === "sat"
      ? (satisfiable ? "pass" : "fail")
      : (satisfiable ? "fail" : "pass");
    return {
      id: check.id,
      solver: "dpll-tseitin",
      expectation: check.expectation,
      status,
      originalVariables,
      auxiliaryVariables: encoding.auxiliaryVariables,
      root: encoding.root,
      cnf: encoding.cnf,
      decisions: statistics.decisions,
      propagations: statistics.propagations,
      pureAssignments: statistics.pureAssignments,
      witness,
    };
  });
  return {
    status: results.every((result) => result.status === "pass") ? "pass" : "fail",
    decisions: results.reduce((total, result) => total + result.decisions, 0),
    propagations: results.reduce((total, result) => total + result.propagations, 0),
    checks: results,
    errors: [],
  };
}

/** Return the closed, explicit initial state described by the Pkl model. */
export function initialLeanState(system) {
  return Object.fromEntries(list(system?.initialValues).map((value) => [value.field, value.value]));
}

function checkedNaturalRecord(value, fields, label) {
  if (!record(value)) throw new Error(`${label} must be an object`);
  const expected = new Set(fields);
  for (const field of expected) {
    if (!(field in value)) throw new Error(`${label} is missing field: ${field}`);
    if (!Number.isInteger(value[field]) || value[field] < 0) {
      throw new Error(`${label} must be a non-negative integer: ${field}`);
    }
  }
  for (const field of Object.keys(value)) {
    if (!expected.has(field)) throw new Error(`${label} has unknown field: ${field}`);
  }
  return value;
}

function checkedActionInput(action, value) {
  if (!record(value)) throw new Error(`action input must be an object: ${action.id}`);
  const parameterIds = list(action.parameters).map((parameter) => parameter.id);
  const expected = new Set(parameterIds);
  for (const parameterId of parameterIds) {
    if (!(parameterId in value)) throw new Error(`action input is missing field: ${action.id}.${parameterId}`);
    if (!Number.isInteger(value[parameterId]) || value[parameterId] < 0) {
      throw new Error(`action input must be a non-negative integer: ${action.id}.${parameterId}`);
    }
  }
  for (const parameterId of Object.keys(value)) {
    if (!expected.has(parameterId)) throw new Error(`action input has unknown field: ${action.id}.${parameterId}`);
  }
  return value;
}

/** Execute one atomic action over the Pkl transition-system interpretation. */
export function executeLeanTransitionSystem(system, state, actionInvocation) {
  const action = list(system?.actions).find((candidate) => candidate.id === actionInvocation?.id);
  if (!action) throw new Error(`unknown transition-system action: ${actionInvocation?.id ?? "missing"}`);
  const stateFields = list(system.stateFields).map((field) => field.id);
  checkedNaturalRecord(state, stateFields, "state");
  const initial = initialLeanState(system);
  const input = checkedActionInput(action, actionInvocation.input ?? {});
  if (!evaluateFormula(action.guard, { state, initial, input })) {
    return { status: "rejected", state: { ...state } };
  }
  const nextState = { ...state };
  for (const update of list(action.updates)) {
    nextState[update.field] = evaluateNatExpression(update.value, { state, initial, input });
  }
  return { status: "accepted", state: nextState };
}

function conformanceInputText(action, input) {
  const fields = list(action.parameters).map((parameter) => parameter.id);
  return fields.length === 0 ? "-" : fields.map((field) => `${field}=${input[field]}`).join(",");
}

function conformanceStateText(system, state) {
  return list(system.stateFields).map((field) => `${field.id}=${state[field.id]}`).join(";");
}

function conformanceActionText(system, invocation) {
  const action = list(system.actions).find((candidate) => candidate.id === invocation.id);
  return `${action.id}(${conformanceInputText(action, invocation.input)})`;
}

function conformanceMaxSteps(system) {
  return Math.max(1, ...list(system.boundedReachability)
    .map((check) => check.maxSteps)
    .filter((maxSteps) => Number.isInteger(maxSteps) && maxSteps >= 0));
}

function enumerateGeneratedConformancePaths(system) {
  const invocations = enumerateActionInvocations(system);
  const paths = [];
  let frontier = [[]];
  for (let depth = 1; depth <= conformanceMaxSteps(system); depth += 1) {
    frontier = frontier.flatMap((path) => invocations.map((invocation) => [...path, invocation]));
    if (paths.length + frontier.length > 10_000) {
      throw new Error("generated Lean bounded conformance exceeds 10000 paths");
    }
    paths.push(...frontier);
  }
  return paths;
}

function expectedGeneratedPathConformance(system) {
  const initial = initialLeanState(system);
  return enumerateGeneratedConformancePaths(system).map((path) => {
    let state = initial;
    const trace = path.map((invocation) => {
      const transition = executeLeanTransitionSystem(system, state, invocation);
      state = transition.state;
      return `${transition.status}:${conformanceStateText(system, state)}`;
    });
    return {
      path,
      record: `dspec-conformance|path=${path.map((invocation) => conformanceActionText(system, invocation)).join(">")}|${trace.join(">")}`,
    };
  });
}

/**
 * Compare Lean's generated `denote` execution with the Pkl interpreter for
 * every finite action path through the largest declared bounded-reachability
 * depth. This is not a proof over arbitrary states or natural-number inputs.
 */
export function verifyGeneratedLeanTransitionConformance(system, leanStdout) {
  const errors = validateLeanTransitionSystem(system);
  if (errors.length > 0) {
    return { status: "fail", assurance: "bounded-path-conformance", checkedPaths: 0, checks: [], errors };
  }
  const expected = expectedGeneratedPathConformance(system);
  let actual;
  try {
    const output = String(leanStdout ?? "");
    const start = output.indexOf("[");
    const end = output.lastIndexOf("]");
    if (start < 0 || end < start) throw new Error("generated Lean output did not contain a conformance list");
    actual = JSON.parse(output.slice(start, end + 1));
    if (!Array.isArray(actual) || actual.some((entry) => typeof entry !== "string")) {
      throw new Error("generated Lean conformance output must be a list of strings");
    }
  } catch (error) {
    return {
      status: "fail",
      assurance: "bounded-path-conformance",
      checkedPaths: 0,
      checks: [],
      errors: [`cannot parse generated Lean conformance output: ${error.message}`],
    };
  }

  const checks = expected.map((entry, index) => ({
    path: entry.path,
    expected: entry.record,
    actual: actual[index] ?? null,
    status: actual[index] === entry.record ? "pass" : "fail",
  }));
  if (actual.length !== expected.length) {
    errors.push(`generated Lean conformance record count differs: expected ${expected.length}, received ${actual.length}`);
  }
  for (const check of checks.filter((check) => check.status === "fail")) {
    errors.push(`generated Lean transition disagrees with Pkl: ${check.path.map((invocation) => conformanceActionText(system, invocation)).join(">")}`);
  }
  return {
    status: errors.length === 0 ? "pass" : "fail",
    assurance: "bounded-path-conformance",
    checkedPaths: expected.length,
    checks,
    errors,
  };
}

function renderLeanIdentifier(identifier) {
  if (/^[A-Za-z_][A-Za-z0-9_']*$/.test(identifier)) return identifier;
  return `«${identifier}»`;
}

function renderLeanNatExpression(expression) {
  switch (expression.kind) {
    case "state":
      return `state.${renderLeanIdentifier(expression.field)}`;
    case "initial":
      return `initial.${renderLeanIdentifier(expression.field)}`;
    case "input":
      return renderLeanIdentifier(expression.field);
    case "literal":
      return String(expression.value);
    case "add":
      return `(${renderLeanNatExpression(expression.children[0])} + ${renderLeanNatExpression(expression.children[1])})`;
    case "sub":
      return `(${renderLeanNatExpression(expression.children[0])} - ${renderLeanNatExpression(expression.children[1])})`;
    default:
      throw new Error(`cannot render unknown natural-number expression kind: ${expression.kind}`);
  }
}

function renderLeanFormula(formula) {
  switch (formula.kind) {
    case "le":
      return `${renderLeanNatExpression(formula.terms[0])} ≤ ${renderLeanNatExpression(formula.terms[1])}`;
    case "eq":
      return `${renderLeanNatExpression(formula.terms[0])} = ${renderLeanNatExpression(formula.terms[1])}`;
    case "and":
      return formula.children.map(renderLeanFormula).join(" ∧ ");
    case "implies":
      return `${renderLeanFormula(formula.children[0])} → ${renderLeanFormula(formula.children[1])}`;
    default:
      throw new Error(`cannot render unknown formula kind: ${formula.kind}`);
  }
}

/**
 * Render the closed natural-number transition-system fragment as Lean data
 * and its `denote` transition function. The output is deliberately small: it
 * contains no theorem about the JavaScript evaluator, only the model Lean
 * itself can compile and reason about.
 */
export function renderLeanTransitionSystem(system) {
  const errors = validateLeanTransitionSystem(system);
  if (errors.length > 0) throw new Error(`cannot render invalid Lean transition system: ${errors.join("; ")}`);

  const fields = list(system.stateFields).map((field) => field.id);
  const initialValues = new Map(list(system.initialValues).map((entry) => [entry.field, entry.value]));
  const actions = list(system.actions);
  const stateLines = fields.map((field) => `  ${renderLeanIdentifier(field)} : Nat`);
  const actionLines = actions.flatMap((action) => {
    const parameters = list(action.parameters);
    const renderedParameters = parameters.length === 0
      ? ""
      : ` ${parameters.map((parameter) => `(${renderLeanIdentifier(parameter.id)} : Nat)`).join(" ")}`;
    return [`  | ${renderLeanIdentifier(action.id)}${renderedParameters}`];
  });
  const initial = fields.map((field) => `${renderLeanIdentifier(field)} := ${initialValues.get(field)}`).join(", ");
  const cases = actions.map((action) => {
    const parameters = list(action.parameters);
    const pattern = parameters.length === 0
      ? `.${renderLeanIdentifier(action.id)}`
      : `.${renderLeanIdentifier(action.id)} ${parameters.map((parameter) => renderLeanIdentifier(parameter.id)).join(" ")}`;
    const updates = new Map(list(action.updates).map((update) => [update.field, update.value]));
    const renderedState = updates.size === 0
      ? "state"
      : `{ ${fields.map((field) => `${renderLeanIdentifier(field)} := ${updates.has(field)
        ? renderLeanNatExpression(updates.get(field))
        : `state.${renderLeanIdentifier(field)}`}`).join(", ")} }`;
    return [
      `  | ${pattern} =>`,
      `    if ${renderLeanFormula(action.guard)} then`,
      `      some ${renderedState}`,
      "    else",
      "      none",
    ].join("\n");
  });
  const renderedStateText = fields
    .map((field) => `${JSON.stringify(`${field}=`)} ++ toString state.${renderLeanIdentifier(field)}`)
    .join(` ++ ${JSON.stringify(";")} ++ `);
  const conformanceRecords = enumerateGeneratedConformancePaths(system).map((path) => {
    const actionTerms = path.map((invocation) => {
      const action = actions.find((candidate) => candidate.id === invocation.id);
      const arguments_ = list(action.parameters).map((parameter) => invocation.input[parameter.id]).join(" ");
      return arguments_.length === 0
        ? `.${renderLeanIdentifier(action.id)}`
        : `.${renderLeanIdentifier(action.id)} ${arguments_}`;
    });
    return [
      `  ${JSON.stringify(`dspec-conformance|path=${path.map((invocation) => conformanceActionText(system, invocation)).join(">")}|`)} ++`,
      `    renderTrace (run initial [${actionTerms.join(", ")}])`,
    ].join("\n");
  });

  return [
    `/-! Generated from Pkl transition system ${system.id}. Do not edit by hand. -/`,
    "",
    "namespace DspecGenerated",
    "",
    "structure State where",
    ...stateLines,
    "  deriving Repr, DecidableEq",
    "",
    "inductive Action where",
    ...actionLines,
    "  deriving Repr, DecidableEq",
    "",
    `def initial : State := { ${initial} }`,
    "",
    "def denote (state : State) (action : Action) : Option State :=",
    "  match action with",
    ...cases,
    "",
    "def renderState (state : State) : String :=",
    `  ${renderedStateText}`,
    "",
    "def run (state : State) : List Action → List (Bool × State)",
    "  | [] => []",
    "  | action :: rest =>",
    "    match denote state action with",
    "    | some next => (true, next) :: run next rest",
    "    | none => (false, state) :: run state rest",
    "",
    "def renderStep (entry : Bool × State) : String :=",
    "  match entry with",
    "  | (accepted, state) => (if accepted then \"accepted:\" else \"rejected:\") ++ renderState state",
    "",
    "def renderTrace : List (Bool × State) → String",
    "  | [] => \"\"",
    "  | step :: [] => renderStep step",
    "  | step :: rest => renderStep step ++ \">\" ++ renderTrace rest",
    "",
    "def boundedConformance : List String := [",
    conformanceRecords.join(",\n"),
    "]",
    "",
    "#eval boundedConformance",
    "",
    "end DspecGenerated",
    "",
  ].join("\n");
}

function temporalPathTrace(system, path) {
  const trace = [initialLeanState(system)];
  for (const [index, step] of list(path).entries()) {
    const input = Object.fromEntries(list(step.input).map((entry) => [entry.field, entry.value]));
    const transition = executeLeanTransitionSystem(system, trace.at(-1), { id: step.action, input });
    if (transition.status !== "accepted") {
      throw new Error(`temporal path action was rejected: ${step.action} at step ${index}`);
    }
    trace.push(transition.state);
  }
  return trace;
}

/**
 * Enumerate every action sequence from depth zero through `maxSteps` using
 * only the finite action values declared for bounded analysis. A rejected
 * action remains in a trace as a stuttering transition, so safety properties
 * are checked over the same operational behavior as generated Lean `run`.
 */
function temporalAllPathsTraces(system, maxSteps) {
  const invocations = enumerateActionInvocations(system);
  const paths = [[]];
  let frontier = [[]];
  for (let depth = 1; depth <= maxSteps; depth += 1) {
    frontier = frontier.flatMap((path) => invocations.map((invocation) => [...path, invocation]));
    if (paths.length + frontier.length > MAX_BOUNDED_TEMPORAL_PATHS) {
      throw new Error(`bounded temporal exploration exceeds ${MAX_BOUNDED_TEMPORAL_PATHS} paths`);
    }
    paths.push(...frontier);
  }
  return paths.map((path) => {
    const trace = [initialLeanState(system)];
    for (const invocation of path) {
      const transition = executeLeanTransitionSystem(system, trace.at(-1), invocation);
      trace.push(transition.state);
    }
    return { path, trace };
  });
}

/**
 * Evaluate a temporal formula at one index of a finite trace. `next` is strong:
 * it is false at the final state. `always` and `eventually` range from index
 * through the final state, inclusive.
 */
export function evaluateLeanTemporalFormula(system, trace, formula, index = 0) {
  if (!Array.isArray(trace) || index < 0 || index >= trace.length) return false;
  const initial = initialLeanState(system);
  switch (formula.kind) {
    case "state":
      return evaluateFormula(formula.predicate, { state: trace[index], initial, input: {} });
    case "not":
      return !evaluateLeanTemporalFormula(system, trace, formula.children[0], index);
    case "and":
      return formula.children.every((child) => evaluateLeanTemporalFormula(system, trace, child, index));
    case "or":
      return formula.children.some((child) => evaluateLeanTemporalFormula(system, trace, child, index));
    case "next":
      return index + 1 < trace.length && evaluateLeanTemporalFormula(system, trace, formula.children[0], index + 1);
    case "always":
      return trace.slice(index).every((_, offset) => evaluateLeanTemporalFormula(system, trace, formula.children[0], index + offset));
    case "eventually":
      return trace.slice(index).some((_, offset) => evaluateLeanTemporalFormula(system, trace, formula.children[0], index + offset));
    case "until": {
      const [guard, goal] = formula.children;
      for (let position = index; position < trace.length; position += 1) {
        if (evaluateLeanTemporalFormula(system, trace, goal, position)) return true;
        if (!evaluateLeanTemporalFormula(system, trace, guard, position)) return false;
      }
      return false;
    }
    default: throw new Error(`cannot evaluate unknown temporal formula kind: ${formula.kind}`);
  }
}

function temporalViolation(system, trace, formula, index = 0) {
  if (formula.kind === "always") {
    for (let position = index; position < trace.length; position += 1) {
      if (!evaluateLeanTemporalFormula(system, trace, formula.children[0], position)) {
        return temporalViolation(system, trace, formula.children[0], position) ?? { index: position, state: trace[position] };
      }
    }
  }
  if (formula.kind === "next") {
    const position = Math.min(index + 1, trace.length - 1);
    if (index + 1 >= trace.length || !evaluateLeanTemporalFormula(system, trace, formula.children[0], index + 1)) {
      return temporalViolation(system, trace, formula.children[0], position) ?? { index: position, state: trace[position] };
    }
  }
  if (formula.kind === "and") {
    const child = formula.children.find((candidate) => !evaluateLeanTemporalFormula(system, trace, candidate, index));
    if (child) return temporalViolation(system, trace, child, index) ?? { index, state: trace[index] };
  }
  if (formula.kind === "until") {
    const [guard, goal] = formula.children;
    for (let position = index; position < trace.length; position += 1) {
      if (evaluateLeanTemporalFormula(system, trace, goal, position)) return { index: position, state: trace[position] };
      if (!evaluateLeanTemporalFormula(system, trace, guard, position)) {
        return temporalViolation(system, trace, guard, position) ?? { index: position, state: trace[position] };
      }
    }
    return { index: trace.length - 1, state: trace.at(-1) };
  }
  return { index, state: trace[index] };
}

/**
 * Evaluate explicit traces and bounded universal-path temporal checks from
 * the initial state. `allPaths` is finite model checking, not LTL over
 * infinite traces and not a fairness claim.
 */
export function evaluateLeanTemporalChecks(system, temporalChecks) {
  const errors = [
    ...validateLeanTransitionSystem(system),
    ...validateLeanTemporalChecks(temporalChecks, system),
  ];
  if (errors.length > 0) {
    return { status: "fail", checkedStates: 0, checks: [], errors };
  }

  const checks = [];
  for (const check of list(temporalChecks)) {
    try {
      if (temporalScope(check) === "allPaths") {
        const traces = temporalAllPathsTraces(system, check.maxSteps);
        const counterexample = traces.find(({ trace }) => !evaluateLeanTemporalFormula(system, trace, check.formula));
        const holds = counterexample === undefined;
        const status = check.expectation === "holds"
          ? (holds ? "pass" : "fail")
          : (holds ? "fail" : "pass");
        checks.push({
          id: check.id,
          assurance: "bounded-all-paths",
          expectation: check.expectation,
          maxSteps: check.maxSteps,
          checkedTraces: traces.length,
          checkedStates: traces.reduce((total, entry) => total + entry.trace.length, 0),
          status,
          witness: counterexample === undefined
            ? null
            : {
              path: counterexample.path,
              trace: counterexample.trace,
              violation: temporalViolation(system, counterexample.trace, check.formula),
            },
        });
        continue;
      }
      const trace = temporalPathTrace(system, check.path);
      const holds = evaluateLeanTemporalFormula(system, trace, check.formula);
      const status = check.expectation === "holds"
        ? (holds ? "pass" : "fail")
        : (holds ? "fail" : "pass");
      checks.push({
        id: check.id,
        assurance: temporalAssurance(check),
        expectation: check.expectation,
        status,
        trace,
        ...(temporalHasSchedulingAssumptions(check) ? {
          fairness: list(check.fairness).map((assumption) => ({
            action: assumption.action,
            reason: assumption.reason,
          })),
        } : {}),
        violation: holds ? null : temporalViolation(system, trace, check.formula),
      });
    } catch (error) {
      return {
        status: "fail",
        checkedStates: checks.reduce((total, result) => total + (result.checkedStates ?? result.trace.length), 0),
        checks,
        errors: [error.message],
      };
    }
  }
  return {
    status: checks.every((check) => check.status === "pass") ? "pass" : "fail",
    checkedStates: checks.reduce((total, check) => total + (check.checkedStates ?? check.trace.length), 0),
    checks,
    errors: [],
  };
}

/** Evaluate one named invariant against a state and its explicit initial state. */
export function evaluateLeanInvariant(system, invariantId, initial, state) {
  const invariant = list(system?.invariants).find((candidate) => candidate.id === invariantId);
  if (!invariant) throw new Error(`unknown transition-system invariant: ${invariantId}`);
  return evaluateFormula(invariant.formula, { state, initial, input: {} });
}

function enumerateActionInputs(parameters, index = 0, input = {}) {
  if (index === parameters.length) return [input];
  const parameter = parameters[index];
  return list(parameter.finiteValues).flatMap((value) => enumerateActionInputs(
    parameters,
    index + 1,
    { ...input, [parameter.id]: value },
  ));
}

function enumerateActionInvocations(system) {
  return list(system.actions).flatMap((action) => enumerateActionInputs(list(action.parameters)).map((input) => ({
    id: action.id,
    input,
  })));
}

function stateKey(state, fields) {
  return JSON.stringify(fields.map((field) => state[field]));
}

/**
 * Searches only the author-declared finite action values up to each check's
 * maxSteps. A passing `unreachable` result is bounded evidence, never a proof
 * over the full natural-number input space.
 */
export function boundedReachabilityReport(system) {
  const errors = validateLeanTransitionSystem(system);
  if (errors.length > 0) {
    return { status: "fail", checkedStates: 0, checks: [], errors };
  }

  const checks = list(system.boundedReachability);
  if (checks.length === 0) {
    return { status: "pass", checkedStates: 0, checks: [], errors: [] };
  }

  const stateFields = list(system.stateFields).map((field) => field.id);
  const initial = initialLeanState(system);
  const maxSteps = Math.max(...checks.map((check) => check.maxSteps));
  const invocations = enumerateActionInvocations(system);
  const nodes = [{ depth: 0, state: initial, path: [] }];
  const visited = new Set([stateKey(initial, stateFields)]);
  // `nodes` accumulates every discovered state for witness selection. The
  // current frontier must be a different array: otherwise appending a newly
  // discovered state while iterating depth zero makes the iterator consume the
  // newly appended state too, effectively discarding the max-steps bound.
  let frontier = [...nodes];

  for (let depth = 1; depth <= maxSteps; depth += 1) {
    const nextFrontier = [];
    for (const node of frontier) {
      for (const invocation of invocations) {
        const transition = executeLeanTransitionSystem(system, node.state, invocation);
        if (transition.status !== "accepted") continue;
        const key = stateKey(transition.state, stateFields);
        if (visited.has(key)) continue;
        visited.add(key);
        const next = {
          depth,
          state: transition.state,
          path: [...node.path, invocation],
        };
        nodes.push(next);
        nextFrontier.push(next);
      }
    }
    frontier = nextFrontier;
  }

  const results = checks.map((check) => {
    const witness = nodes.find((node) => node.depth <= check.maxSteps
      && evaluateFormula(check.target, { state: node.state, initial, input: {} }));
    const reached = witness !== undefined;
    const status = check.expectation === "reachable"
      ? (reached ? "pass" : "fail")
      : (reached ? "fail" : "pass");
    return {
      id: check.id,
      assurance: "bounded",
      expectation: check.expectation,
      maxSteps: check.maxSteps,
      status,
      witness: witness ?? null,
    };
  });
  return {
    status: results.every((result) => result.status === "pass") ? "pass" : "fail",
    checkedStates: nodes.length,
    checks: results,
    errors: [],
  };
}

/**
 * Validates the narrow authoring boundary between a Pkl requirement and a
 * declaration in a checked Lean model. It does not claim that Pkl itself has
 * Lean semantics: the Lean source owns the transition relation and theorem.
 */
export function validateLeanSemanticCore(document, { projectRoot = process.cwd() } = {}) {
  const errors = [];
  const model = record(document?.model);
  const core = record(document?.leanCore);
  if (!model) return ["Pkl document must export model"];
  if (!core) return ["Pkl document must export leanCore"];
  if (core.schemaVersion !== LEAN_SEMANTIC_CORE_SCHEMA_VERSION) {
    errors.push(`unsupported leanCore schema version: ${core.schemaVersion ?? "missing"}`);
  }
  if (!core.id) errors.push("leanCore id is required");
  if (typeof core.source !== "string" || !core.source.endsWith(".lean")) {
    errors.push("leanCore source must be a .lean path");
    return errors;
  }

  const resolvedSource = sourcePath(projectRoot, core.source);
  if (!resolvedSource) {
    errors.push(`leanCore source escapes project root: ${core.source}`);
    return errors;
  }
  if (!existsSync(resolvedSource)) {
    errors.push(`Lean source not found: ${core.source}`);
    return errors;
  }
  const leanSource = readFileSync(resolvedSource, "utf8");
  const vocabulary = new Set(list(model.vocabulary).map((term) => term?.id).filter(Boolean));
  const rules = new Set(list(model.rules).map((rule) => rule?.id).filter(Boolean));
  const coreTerms = list(core.terms);
  const seenTerms = new Set();
  for (const termId of coreTerms) {
    if (seenTerms.has(termId)) errors.push(`duplicate leanCore term id: ${termId}`);
    seenTerms.add(termId);
    if (!vocabulary.has(termId)) errors.push(`unknown leanCore term: ${termId}`);
  }

  const transitionErrors = validateLeanTransitionSystem(core.transitionSystem);
  errors.push(...transitionErrors);
  if (core.generatedSource !== null && core.generatedSource !== undefined) {
    if (typeof core.generatedSource !== "string" || !core.generatedSource.endsWith(".lean")) {
      errors.push("leanCore generatedSource must be a .lean path");
    } else {
      const resolvedGeneratedSource = sourcePath(projectRoot, core.generatedSource);
      if (!resolvedGeneratedSource) {
        errors.push(`leanCore generatedSource escapes project root: ${core.generatedSource}`);
      } else if (!existsSync(resolvedGeneratedSource)) {
        errors.push(`generated Lean transition source not found: ${core.generatedSource}`);
      } else if (transitionErrors.length === 0 && readFileSync(resolvedGeneratedSource, "utf8") !== renderLeanTransitionSystem(core.transitionSystem)) {
        errors.push(`generated Lean transition source drift: ${core.generatedSource}`);
      }
    }
  }
  const invariants = new Set(list(core.transitionSystem?.invariants).map((invariant) => invariant?.id).filter(Boolean));

  const claims = list(core.claims);
  duplicateIds(claims, "leanCore claim", errors);
  if (claims.length === 0) errors.push("leanCore requires at least one claim");
  for (const claim of claims) {
    if (!claim?.id) continue;
    if (!rules.has(claim.rule)) {
      errors.push(`unknown Pkl rule: ${claim.id} -> ${claim.rule ?? "missing"}`);
    }
    if (!ASSURANCE_KINDS.has(claim.assurance)) {
      errors.push(`unsupported Lean assurance: ${claim.id} -> ${claim.assurance ?? "missing"}`);
    }
    if (claim.invariant !== null && claim.invariant !== undefined && !invariants.has(claim.invariant)) {
      errors.push(`unknown transition-system invariant: ${claim.id} -> ${claim.invariant}`);
    }
    if (typeof claim.declaration !== "string" || !LEAN_DECLARATION_PATTERN.test(claim.declaration)) {
      errors.push(`invalid Lean declaration: ${claim.id} -> ${claim.declaration ?? "missing"}`);
      continue;
    }
    const declarationKind = leanDeclarationKind(leanSource, claim.declaration);
    if (!declarationKind) {
      errors.push(`Lean declaration not found: ${claim.id} -> ${claim.declaration}`);
    } else if (claim.assurance === "proved" && declarationKind !== "theorem") {
      errors.push(`proved Lean claim must bind a theorem: ${claim.id} -> ${claim.declaration}`);
    }
    for (const termId of list(claim.terms)) {
      if (!seenTerms.has(termId)) errors.push(`claim references undeclared leanCore term: ${claim.id} -> ${termId}`);
    }
  }

  const satChecks = list(core.satChecks);
  errors.push(...validateLeanSatChecks(satChecks));
  for (const check of satChecks) {
    if (!check?.id) continue;
    if (!rules.has(check.rule)) {
      errors.push(`unknown Pkl rule: ${check.id} -> ${check.rule ?? "missing"}`);
    }
    if (typeof check.declaration !== "string" || !LEAN_DECLARATION_PATTERN.test(check.declaration)) {
      errors.push(`invalid Lean declaration: ${check.id} -> ${check.declaration ?? "missing"}`);
    } else {
      const declarationKind = leanDeclarationKind(leanSource, check.declaration);
      if (!declarationKind) {
        errors.push(`Lean declaration not found: ${check.id} -> ${check.declaration}`);
      } else if (declarationKind !== "theorem") {
        errors.push(`SAT check must bind a Lean theorem: ${check.id} -> ${check.declaration}`);
      }
    }
    for (const termId of list(check.terms)) {
      if (!seenTerms.has(termId)) errors.push(`SAT check references undeclared leanCore term: ${check.id} -> ${termId}`);
    }
  }

  const smtChecks = list(core.smtChecks);
  errors.push(...validateLeanSmtChecks(smtChecks));
  for (const check of smtChecks) {
    if (!check?.id) continue;
    if (!rules.has(check.rule)) {
      errors.push(`unknown Pkl rule: ${check.id} -> ${check.rule ?? "missing"}`);
    }
    if (typeof check.declaration !== "string" || !LEAN_DECLARATION_PATTERN.test(check.declaration)) {
      errors.push(`invalid Lean declaration: ${check.id} -> ${check.declaration ?? "missing"}`);
    } else {
      const declarationKind = leanDeclarationKind(leanSource, check.declaration);
      if (!declarationKind) {
        errors.push(`Lean declaration not found: ${check.id} -> ${check.declaration}`);
      } else if (declarationKind !== "theorem") {
        errors.push(`SMT check must bind a Lean theorem: ${check.id} -> ${check.declaration}`);
      }
    }
    for (const termId of list(check.terms)) {
      if (!seenTerms.has(termId)) errors.push(`SMT check references undeclared leanCore term: ${check.id} -> ${termId}`);
    }
  }

  const temporalChecks = list(core.temporalChecks);
  errors.push(...validateLeanTemporalChecks(temporalChecks, core.transitionSystem));
  for (const check of temporalChecks) {
    if (!check?.id) continue;
    if (!rules.has(check.rule)) {
      errors.push(`unknown Pkl rule: ${check.id} -> ${check.rule ?? "missing"}`);
    }
    if (typeof check.declaration !== "string" || !LEAN_DECLARATION_PATTERN.test(check.declaration)) {
      errors.push(`invalid Lean declaration: ${check.id} -> ${check.declaration ?? "missing"}`);
    } else {
      const declarationKind = leanDeclarationKind(leanSource, check.declaration);
      if (!declarationKind) {
        errors.push(`Lean declaration not found: ${check.id} -> ${check.declaration}`);
      } else if (declarationKind !== "theorem") {
        errors.push(`temporal check must bind a Lean theorem: ${check.id} -> ${check.declaration}`);
      }
    }
    for (const termId of list(check.terms)) {
      if (!seenTerms.has(termId)) errors.push(`temporal check references undeclared leanCore term: ${check.id} -> ${termId}`);
    }
  }
  return errors;
}

/**
 * A stable, backend-neutral index used by documentation and evidence reports.
 * It intentionally records the assurance boundary rather than promoting a
 * compiled Lean file to a proof of the application implementation.
 */
export function leanSemanticCoreSourceMap(document) {
  const core = record(document?.leanCore) ?? {};
  const claims = list(core.claims).map((claim) => ({
    assurance: claim.assurance,
    claimId: claim.id,
    declaration: claim.declaration,
    ruleId: claim.rule,
    source: core.source,
  }));
  const satChecks = list(core.satChecks).map((check) => ({
    assurance: "exhaustive",
    claimId: check.id,
    declaration: check.declaration,
    ruleId: check.rule,
    source: core.source,
  }));
  const smtChecks = list(core.smtChecks).map((check) => ({
    assurance: "bounded-exhaustive",
    claimId: check.id,
    declaration: check.declaration,
    ruleId: check.rule,
    source: core.source,
  }));
  const temporalChecks = list(core.temporalChecks).map((check) => ({
    assurance: temporalAssurance(check),
    claimId: check.id,
    declaration: check.declaration,
    ruleId: check.rule,
    source: core.source,
  }));
  return [...claims, ...satChecks, ...smtChecks, ...temporalChecks];
}

/**
 * Runs the Lean checker after validating all Pkl-to-Lean bindings. A missing
 * Lean executable is reported as skipped; callers must not treat that state as
 * formal evidence.
 */
export function verifyLeanSemanticCore(document, {
  projectRoot = process.cwd(),
  leanCommand = "lean",
  z3Command = process.env.Z3_COMMAND ?? "z3",
} = {}) {
  const errors = validateLeanSemanticCore(document, { projectRoot });
  if (errors.length > 0) return emptyReport(document, "fail", errors);

  const core = document.leanCore;
  const boundedReachability = boundedReachabilityReport(core.transitionSystem);
  const sat = solveLeanSatChecks(core.satChecks);
  const dpll = solveLeanSatChecksDpll(core.satChecks);
  const tseitin = solveLeanSatChecksTseitin(core.satChecks);
  const smt = solveLeanSmtChecks(core.smtChecks);
  const z3 = verifyLeanSmtChecksZ3(core.smtChecks, { z3Command });
  const temporal = evaluateLeanTemporalChecks(core.transitionSystem, core.temporalChecks);
  const boundedErrors = boundedReachability.checks
    .filter((check) => check.status === "fail")
    .map((check) => `bounded reachability check failed: ${check.id}`);
  const satErrors = sat.checks
    .filter((check) => check.status === "fail")
    .map((check) => `SAT check failed: ${check.id}`);
  const smtErrors = smt.checks
    .filter((check) => check.status === "fail")
    .map((check) => `SMT check failed: ${check.id}`);
  const temporalErrors = temporal.checks
    .filter((check) => check.status === "fail")
    .map((check) => `temporal check failed: ${check.id}`);
  const dpllById = new Map(dpll.checks.map((check) => [check.id, check]));
  const dpllErrors = sat.checks.flatMap((check) => {
    const candidate = dpllById.get(check.id);
    if (!candidate) return [`DPLL result missing for SAT check: ${check.id}`];
    if ((candidate.witness === null) !== (check.witness === null)) {
      return [`DPLL disagrees with exhaustive SAT result: ${check.id}`];
    }
    return [];
  });
  const tseitinById = new Map(tseitin.checks.map((check) => [check.id, check]));
  const tseitinErrors = sat.checks.flatMap((check) => {
    const candidate = tseitinById.get(check.id);
    if (!candidate) return [`Tseitin result missing for SAT check: ${check.id}`];
    if ((candidate.witness === null) !== (check.witness === null)) {
      return [`Tseitin DPLL disagrees with exhaustive SAT result: ${check.id}`];
    }
    return [];
  });
  const z3ById = new Map(z3.checks.map((check) => [check.id, check]));
  const z3Errors = z3.status === "skip" ? [] : [
    ...z3.errors,
    ...smt.checks.flatMap((check) => {
      const candidate = z3ById.get(check.id);
      if (!candidate) return [`Z3 result missing for SMT check: ${check.id}`];
      const referenceResult = check.witness === null ? "unsat" : "sat";
      if (candidate.result !== referenceResult) {
        return [`Z3 disagrees with bounded SMT result: ${check.id}`];
      }
      return [];
    }),
  ];
  const run = spawnSync(leanCommand, [resolve(projectRoot, core.source)], {
    cwd: projectRoot,
    encoding: "utf8",
  });
  const generatedRun = typeof core.generatedSource === "string"
    ? spawnSync(leanCommand, [resolve(projectRoot, core.generatedSource)], {
      cwd: projectRoot,
      encoding: "utf8",
    })
    : null;
  const generatedConformance = generatedRun?.status === 0
    ? verifyGeneratedLeanTransitionConformance(core.transitionSystem, generatedRun.stdout)
    : null;
  const generatedCompileStatus = generatedRun === null
    ? null
    : (generatedRun.error?.code === "ENOENT" ? "skip" : (generatedRun.status === 0 ? "pass" : "fail"));
  const generatedTransition = generatedRun === null
    ? null
    : {
      source: core.generatedSource,
      status: generatedCompileStatus === "pass" && generatedConformance?.status === "fail" ? "fail" : generatedCompileStatus,
      stdout: generatedRun.stdout ?? "",
      stderr: generatedRun.stderr ?? "",
      conformance: generatedConformance,
    };
  const generatedErrors = [
    ...(generatedCompileStatus === "fail"
      ? [generatedRun.error
        ? `generated Lean invocation failed: ${generatedRun.error.message}`
        : `generated Lean transition exited with status ${generatedRun.status}: ${core.generatedSource}`]
      : []),
    ...(generatedConformance?.status === "fail"
      ? generatedConformance.errors.map((error) => `generated Lean conformance failed: ${error}`)
      : []),
  ];
  if (run.error?.code === "ENOENT") {
    const report = emptyReport(document, boundedReachability.status === "pass" && sat.status === "pass" && smt.status === "pass" && temporal.status === "pass" && dpllErrors.length === 0 && tseitinErrors.length === 0 && z3Errors.length === 0 && generatedErrors.length === 0 ? "skip" : "fail", [
      ...boundedErrors,
      ...satErrors,
      ...smtErrors,
      ...temporalErrors,
      ...dpllErrors,
      ...tseitinErrors,
      ...z3Errors,
      ...generatedErrors,
      `Lean executable not found: ${leanCommand}`,
    ]);
    return { ...report, boundedReachability, sat, dpll, tseitin, smt, z3, temporal, generatedTransition };
  }
  if (run.error) {
    const report = emptyReport(document, "fail", [
      ...boundedErrors,
      ...satErrors,
      ...smtErrors,
      ...temporalErrors,
      ...dpllErrors,
      ...tseitinErrors,
      ...z3Errors,
      ...generatedErrors,
      `Lean invocation failed: ${run.error.message}`,
    ]);
    return { ...report, boundedReachability, sat, dpll, tseitin, smt, z3, temporal, generatedTransition };
  }

  const bindings = leanSemanticCoreSourceMap(document).map((binding) => ({ ...binding, status: run.status === 0 ? "pass" : "fail" }));
  const passed = bindings.filter((binding) => binding.status === "pass").length;
  return {
    schemaVersion: LEAN_SEMANTIC_CORE_SCHEMA_VERSION,
    model: { id: document.model.id, version: document.model.version },
    status: run.status === 0 && boundedReachability.status === "pass" && sat.status === "pass" && smt.status === "pass" && temporal.status === "pass" && dpllErrors.length === 0 && tseitinErrors.length === 0 && z3Errors.length === 0 && generatedErrors.length === 0 ? "pass" : "fail",
    summary: { claims: bindings.length, passed, failed: bindings.length - passed },
    bindings,
    boundedReachability,
    sat,
    dpll,
    tseitin,
    smt,
    z3,
    temporal,
    generatedTransition,
    errors: [
      ...boundedErrors,
      ...satErrors,
      ...smtErrors,
      ...temporalErrors,
      ...dpllErrors,
      ...tseitinErrors,
      ...z3Errors,
      ...generatedErrors,
      ...(run.status === 0 ? [] : [`Lean exited with status ${run.status}`]),
    ],
    stdout: run.stdout ?? "",
    stderr: run.stderr ?? "",
  };
}
